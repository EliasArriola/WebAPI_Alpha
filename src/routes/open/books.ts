//express is the framework we're going to use to handle requests
import express, { Request, Response, Router } from 'express';
//Access the connection to Postgres Database
import { pool } from '../../core/utilities';
import { IBook } from '../../core/utilities/interfaces';


const messageRouterBook: Router = express.Router();

//VALIDATION FUNCTION FOR BOOK INPUT
function validateBookInput(body: any): string | null {
    const requiredFields = [
        'isbn13', 'authors', 'publication_year', 'original_title', 'title',
        'rating_avg', 'rating_count',
        'rating_1_star', 'rating_2_star', 'rating_3_star',
        'rating_4_star', 'rating_5_star',
        'image_url', 'image_small_url'
    ];

    for (const field of requiredFields) {
        if (body[field] === undefined || body[field] === null) {
            return `Missing field: ${field}`;
        }
    }

    if (!/^\d{13}$/.test(body.isbn13.toString())) {
        return 'isbn13 must be a 13-digit number';
    }

    return null; // No errors
}

//START OF ADD BOOK
messageRouterBook.post('/book', async (req: Request, res: Response) => {
    const validationError = validateBookInput(req.body);

    if (validationError) {
        return res.status(400).json({ message: validationError });
    }

    const {
        isbn13,
        authors,
        publication_year,
        original_title,
        title,
        rating_avg,
        rating_count,
        rating_1_star,
        rating_2_star,
        rating_3_star,
        rating_4_star,
        rating_5_star,
        image_url,
        image_small_url
    } = req.body;

    const query = `
        INSERT INTO BOOKS (
            isbn13, authors, publication_year, original_title, title,
            rating_avg, rating_count,
            rating_1_star, rating_2_star, rating_3_star, rating_4_star, rating_5_star,
            image_url, image_small_url
        ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7,
            $8, $9, $10, $11, $12,
            $13, $14
        )
        RETURNING *
    `;

    const values = [
        isbn13,
        authors,
        publication_year,
        original_title,
        title,
        rating_avg,
        rating_count,
        rating_1_star,
        rating_2_star,
        rating_3_star,
        rating_4_star,
        rating_5_star,
        image_url,
        image_small_url
    ];
    try {
        const result = await pool.query(query, values);
        res.status(201).json({
            message: 'Book successfully created',
            book: result.rows[0]
        });
    } catch (err) {
        console.error('Error inserting book:', err);
        res.status(500).json({
            message: 'Failed to insert book — possibly duplicate ISBN or DB error.'
        });
    }
});
//END OF ADD BOOK

//START OF GETTING BOOK BY ISBN
// GET a book by ISBN
messageRouterBook.get(
    '/isbn',
    async (request: Request, response: Response) => {
        const isbn = request.query.isbn;

        // Validate that ISBN exists and is a string
        if (!isbn || typeof isbn !== 'string') {
            return response.status(400).json({
                message: 'Missing required query parameter: isbn',
            });
        }

        const theQuery = `
            SELECT * FROM BOOKS WHERE isbn13 = $1
        `;

        const values = [isbn];

        try {
            const result = await pool.query(theQuery, values);

            if (result.rowCount === 0) {
                return response.status(404).json({
                    message: `No book found with ISBN ${isbn}`,
                });
            }

            const row = result.rows[0];

            const book: IBook = {
                isbn13: Number(row.isbn13),
                authors: row.authors,
                publication: row.publication_year,
                original_title: row.original_title,
                title: row.title,
                ratings: {
                    average: Number(row.rating_avg),
                    count: Number(row.rating_count),
                    rating_1: Number(row.rating_1_star),
                    rating_2: Number(row.rating_2_star),
                    rating_3: Number(row.rating_3_star),
                    rating_4: Number(row.rating_4_star),
                    rating_5: Number(row.rating_5_star),
                },
                icons: {
                    large: row.image_url,
                    small: row.image_small_url,
                },
            };

            response.json(book);
        } catch (error) {
            console.error('DB Query error on GET by ISBN:', error);
            response.status(500).json({
                message: 'Server error - contact support',
            });
        }
    }
);
//END OF GETTING BOOK BY ISBN
//START OF GETTING BOOK BY AUTHOR
messageRouterBook.get(
    '/author',
    async (request: Request, response: Response) => {
        const author = request.query.authors;

        if (!author || typeof author !== 'string') {
            return response.status(400).json({
                message: 'Missing required query parameter: authors',
            });
        }

        const theQuery = `
            SELECT * FROM BOOKS WHERE authors ILIKE $1
        `;
        const values = [`%${author}%`];

        try {
            const result = await pool.query(theQuery, values);

            if (result.rowCount === 0) {
                return response.status(404).json({
                    message: `No book found with authors ${author}`,
                });
            }

            const books: IBook[] = result.rows.map(row => ({
                isbn13: Number(row.isbn13),
                authors: row.authors,
                publication: row.publication_year,
                original_title: row.original_title,
                title: row.title,
                ratings: {
                    average: Number(row.rating_avg),
                    count: Number(row.rating_count),
                    rating_1: Number(row.rating_1_star),
                    rating_2: Number(row.rating_2_star),
                    rating_3: Number(row.rating_3_star),
                    rating_4: Number(row.rating_4_star),
                    rating_5: Number(row.rating_5_star),
                },
                icons: {
                    large: row.image_url,
                    small: row.image_small_url,
                },
            }));

            response.json({ books });
        } catch (error) {
            console.error('DB Query error on GET by Author:', error);
            response.status(500).json({
                message: 'Server error - contact support',
            });
        }
    }
);

export { messageRouterBook };