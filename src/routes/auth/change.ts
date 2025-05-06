import express, { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';

import {
    pool,
    validationFunctions,
    credentialingFunctions,
} from '../../core/utilities';

import { checkToken } from '../../core/middleware/jwt';
import { IJwtRequest } from '../../core/models/JwtRequest.model';

const isStringProvided = validationFunctions.isStringProvided;
const generateHash = credentialingFunctions.generateHash;
const generateSalt = credentialingFunctions.generateSalt;

const changeRouter: Router = express.Router();

const key = {
    secret: process.env.JSON_WEB_TOKEN!,
};

//Validate password format
function isValidPassword(password: string): boolean {
    return isStringProvided(password) && password.length > 7;
}

/**
 * @api {patch} /change Change Password
 * @apiName PatchChangePassword
 * @apiGroup Account
 * @apiPermission authenticated user
 *
 * @apiDescription Allows a logged-in user to change their account password. Requires a valid JWT.
 * The new password must be at least 8 characters and different from the current password.
 *
 * @apiHeader {String} Authorization Bearer token.
 *
 * @apiBody {String} oldpassword The user's current password.
 * @apiBody {String} newpassword The new password to replace the old one.
 *
 * @apiSuccess (200: Success) {String} message Success message.
 * @apiSuccess (200: Success) {String} accessToken A new JWT access token with updated credentials.
 *
 * @apiError (400: Validation) {String} message Invalid or missing password input.
 * @apiError (400: Validation) {String} message Current password is incorrect.
 * @apiError (400: Validation) {String} message New password must differ from current password.
 * @apiError (404: Not Found) {String} message User not found.
 * @apiError (401: Unauthorized) {String} message Missing token.
 * @apiError (403: Forbidden) {String} message Invalid token.
 * @apiError (500: Server Error) {String} message Server error - please contact support.
 */
changeRouter.patch('/change', checkToken, async (req: IJwtRequest, res: Response) => {
    const { oldpassword, newpassword } = req.body;

    if (!isValidPassword(oldpassword) || !isValidPassword(newpassword)) {
        return res.status(400).send({
            message: 'Invalid or missing password - must be at least 8 characters',
        });
    }

    const email = req.claims?.email;
    if (!email) {
        return res.status(400).send({ message: 'User email missing from token' });
    }

    try {
        const query = `
            SELECT ac.Salted_Hash, ac.salt, a.Account_ID, a.FirstName, a.Account_Role
            FROM Account_Credential ac
            JOIN Account a ON a.Account_ID = ac.Account_ID
            WHERE a.Email = $1
        `;
        const result = await pool.query(query, [email]);

        if (result.rows.length === 0) {
            return res.status(404).send({ message: 'User not found' });
        }

        const {
            salted_hash: storedHash,
            salt,
            account_id,
            firstname,
            account_role,
        } = result.rows[0];

        const oldHash = generateHash(oldpassword, salt);
        if (oldHash !== storedHash) {
            return res.status(400).send({ message: 'Current password is incorrect' });
        }

        const newHashCheck = generateHash(newpassword, salt);
        if (newHashCheck === storedHash) {
            return res.status(400).send({ message: 'New password must differ from current password' });
        }

        const newSalt = generateSalt(32);
        const newHash = generateHash(newpassword, newSalt);

        const updateQuery = `
            UPDATE Account_Credential
            SET Salted_Hash = $1, salt = $2
            WHERE Account_ID = $3
        `;
        await pool.query(updateQuery, [newHash, newSalt, account_id]);

        const accessToken = jwt.sign(
            {
                name: firstname,
                role: account_role,
                id: account_id,
                email: email,
            },
            key.secret,
            { expiresIn: '14 days' }
        );

        return res.status(200).send({
            message: 'Password changed successfully',
            accessToken,
        });
    } catch (err) {
        console.error('Password change error:', err);
        return res.status(500).send({
            message: 'Server error - please contact support',
        });
    }
});

export { changeRouter };
