const express = require('express');
const router = express.Router();
const User = require('../../models/user');

const { param, query, oneOf } = require('express-validator');

const { errorMessages, errorFormatter, hasErrorIn} = require('../../misc/utils');

const mapUser = (user) => {
    return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
    };
}

router.get('/all', (req, res, next) => {
    User.find()
        .then((users) => {
            const mappedUsers = users.map(user => mapUser(user));
            return res
                .status(200)
                .json({
                    length: users.length,
                    data: mappedUsers
                })
        })
        .catch(error => {
            next(error);
        });
});

router.get('', [ 
    oneOf([ 
        query('search')
            .exists() 
            //.withMessage(errorMessages.get('shouldExist'))
            .notEmpty() 
            //.withMessage(errorMessages.get('shouldNotEmpty'))
            .trim()
            .escape(),
        query('page')
            .exists()
            // .withMessage(errorMessages.get('shouldExist'))
            .toInt(),

        ], 
        'Search or page is required.'
    ),
    query('count').toInt()],
    async (req, res, next) => {

        const [errorResult, errors] = hasErrorIn(req);

        if (errorResult === true) {
            return res
                .status(400)
                .json({
                    data: {
                        message: errors
                    }
                });
        }

        let query = {};

        if (req.query.search) {
            // && req.query.search !== ''
            // handle search
            const searchTerm = req.query.search;

            query = {$or:[{firstName:{$regex: searchTerm, $options: 'i'}},{lastName:{$regex: searchTerm, $options: 'i'}}]};
            // query = {email:{$regex: searchTerm, $options: 'i'}};
        }

        const page = req.query.page || 1;
        const perPage = req.query.count || 10;
        const from = (page - 1) * perPage;

        User.paginate(query, {page, limit: perPage})
            .then(result => {
                const users = result.docs.map(doc => mapUser(doc));
                res
                    .status(200)
                    .json({
                        data: users,
                        meta: {
                            total: result.total,
                            numItems: users.length, // can be smaller than perPage, if we are on the lastPage
                            from: from + 1,
                            to: from + users.length,
                            perPage,
                            currentPage: page,
                            lastPage: result.pages
                        }
                    });
            })
            .catch(error => {
                res
                    .status(404)
                    .json({
                        data: {
                            message: error
                        }
                    });
            });
        
});

router.put('/:id', (req, res, next) => {

    const id = req.params.id.toString();
    const body = req.body.data;

    User.findByIdAndUpdate(id, body)
        .then(user => {
            res.status(200).json({
                data: {
                    id,
                    message: 'User successfully modified!'
                }
                
            });
        })
        .catch(error => {
            res.status(404).json({
                data: {
                    id,
                    message: 'User was not found.'
                }
            });
        });
});

router.get('/:id', async (req, res, next) => {

    const id = req.params.id.toString();
    const user = await User.findById(id);

    if (user) {
        return res.status(200).json({
            data: mapUser(user)
        });
    }
    
    return res.status(404).json({
        data: {
            id: id,
            message: 'User was not found.',
        }
    });
});

router.delete('/:id', [ param('id').exists().notEmpty().trim().escape() ], async (req, res, next) => {

    const id = req.params.id;
    const user = await User.findByIdAndDelete(id);

    if (user) {
        return res.status(200).json({
            data: {
                message: `User (${user.email}) is deleted.`
            }
        });
    }
    
    return res.status(404).json({
        data: {
            message: `User with ${user.email} was not found.`,
        }
    });
});

module.exports = router;