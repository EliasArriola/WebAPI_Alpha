//express is the framework we're going to use to handle requests
import express, { Request, Response, Router } from 'express';
//Access the connection to Postgres Database
import { pool } from '../../core/utilities';
import { IBook } from '../../core/utilities/interfaces';

const messageRouterBook: Router = express.Router();

//VALIDATION FUNCTION FOR BOOK INPUT
function validateBookInput(body: any): string | null {
    const requiredFields = [
        'isbn13',
        'authors',
        'publication_year',
        'original_title',
        'title',
        'rating_avg',
        'rating_count',
        'rating_1_star',
        'rating_2_star',
        'rating_3_star',
        'rating_4_star',
        'rating_5_star',
        'image_url',
        'image_small_url',
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

/**
 * @apiDefine JSONError
 * @apiError (400: JSON Error) {String} message "malformed JSON in parameters"
 */

/**
 * @api {post} /book Request to add a new book
 *
 * @apiDescription Request to add a book to the database with all required fields
 *
 * @apiName PostBook
 * @apiGroup Book
 *
 * @apiBody {string} isbn13 The book's 13-digit ISBN (must be exactly 13 digits)
 * @apiBody {string} authors The author(s) of the book
 * @apiBody {number} publication_year The year the book was published
 * @apiBody {string} original_title The original title of the book
 * @apiBody {string} title The current title of the book (may differ from original title)
 * @apiBody {number} rating_avg The average rating of the book
 * @apiBody {number} rating_count The number of ratings
 * @apiBody {number} rating_1_star The number of 1-star ratings
 * @apiBody {number} rating_2_star The number of 2-star ratings
 * @apiBody {number} rating_3_star The number of 3-star ratings
 * @apiBody {number} rating_4_star The number of 4-star ratings
 * @apiBody {number} rating_5_star The number of 5-star ratings
 * @apiBody {string} image_url URL to the book's large cover image
 * @apiBody {string} image_small_url URL to the book's small cover image
 *
 * @apiSuccess (Success 201) {String} message "Book successfully created"
 * @apiSuccess (Success 201) {Object} book The book object that was created
 *
 * @apiError (400: Missing Parameters) {String} message "Missing field: [fieldname]"
 * @apiError (400: Invalid ISBN) {String} message "isbn13 must be a 13-digit number"
 * @apiError (500: Database Error) {String} message "Failed to insert book — possibly duplicate ISBN or DB error."
 * @apiUse JSONError
 */
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
        image_small_url,
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
        image_small_url,
    ];
    try {
        const result = await pool.query(query, values);
        res.status(201).json({
            message: 'Book successfully created',
            book: result.rows[0],
        });
    } catch (err: any) {
        if (err.code === '23505') { //postgres unique violation code
            return res.status(400).json({ message: 'ISBN13 already exists' });
        }
        console.error('Error inserting book:', err);
        res.status(500).json({ message: `Failed to insert book: ${err.message}` });
    }    

});

/**
 * @api {get} /isbn Request to retrieve a book by ISBN
 *
 * @apiDescription Request to retrieve a book by its ISBN13 number
 *
 * @apiName GetBookByISBN
 * @apiGroup Book
 *
 * @apiQuery {string} isbn The 13-digit ISBN to search for
 *
 * @apiSuccess {Object} book The book object with the requested ISBN
 * @apiSuccess {string} book.isbn13 The book's ISBN (13-digit)
 * @apiSuccess {string} book.authors The author(s) of the book
 * @apiSuccess {number} book.publication The year the book was published
 * @apiSuccess {string} book.original_title The original title of the book
 * @apiSuccess {string} book.title The current title of the book
 * @apiSuccess {Object} book.ratings The ratings information
 * @apiSuccess {number} book.ratings.average The average rating
 * @apiSuccess {number} book.ratings.count The total number of ratings
 * @apiSuccess {number} book.ratings.rating_1 The number of 1-star ratings
 * @apiSuccess {number} book.ratings.rating_2 The number of 2-star ratings
 * @apiSuccess {number} book.ratings.rating_3 The number of 3-star ratings
 * @apiSuccess {number} book.ratings.rating_4 The number of 4-star ratings
 * @apiSuccess {number} book.ratings.rating_5 The number of 5-star ratings
 * @apiSuccess {Object} book.icons The book cover image URLs
 * @apiSuccess {string} book.icons.large URL to large book cover image
 * @apiSuccess {string} book.icons.small URL to small book cover image
 *
 * @apiError (400: Missing Parameter) {String} message "Missing required query parameter: isbn"
 * @apiError (404: Book Not Found) {String} message "No book found with ISBN [isbn]"
 * @apiError (500: Database Error) {String} message "Server error - contact support"
 */
messageRouterBook.get('/isbn', async (request: Request, response: Response) => {
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
});

/**
 * @api {get} /author Request to retrieve books by author
 *
 * @apiDescription Request to retrieve all books by a specified author or partial author name
 *
 * @apiName GetBooksByAuthor
 * @apiGroup Book
 *
 * @apiQuery {string} authors The author name or partial name to search for
 *
 * @apiSuccess {Object[]} books Array of book objects matching the author search
 * @apiSuccess {string} books.isbn13 The book's ISBN (13-digit)
 * @apiSuccess {string} books.authors The author(s) of the book
 * @apiSuccess {number} books.publication The year the book was published
 * @apiSuccess {string} books.original_title The original title of the book
 * @apiSuccess {string} books.title The current title of the book
 * @apiSuccess {Object} books.ratings The ratings information
 * @apiSuccess {number} books.ratings.average The average rating
 * @apiSuccess {number} books.ratings.count The total number of ratings
 * @apiSuccess {number} books.ratings.rating_1 The number of 1-star ratings
 * @apiSuccess {number} books.ratings.rating_2 The number of 2-star ratings
 * @apiSuccess {number} books.ratings.rating_3 The number of 3-star ratings
 * @apiSuccess {number} books.ratings.rating_4 The number of 4-star ratings
 * @apiSuccess {number} books.ratings.rating_5 The number of 5-star ratings
 * @apiSuccess {Object} books.icons The book cover image URLs
 * @apiSuccess {string} books.icons.large URL to large book cover image
 * @apiSuccess {string} books.icons.small URL to small book cover image
 *
 * @apiError (400: Missing Parameter) {String} message "Missing required query parameter: authors"
 * @apiError (404: No Books Found) {String} message "No book found with authors [authors]"
 * @apiError (500: Database Error) {String} message "Server error - contact support"
 */
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

            const books: IBook[] = result.rows.map((row) => ({
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

/**
 * @api {get} /all Request to retrieve all books with pagination
 *
 * @apiDescription Retrieves a paginated list of all books in the database. You can customize the number of books per page and the page number using query parameters.
 *
 * @apiName GetAllBooks
 * @apiGroup Book
 *
 * @apiQuery {Number} [page=1] The page number to retrieve
 * @apiQuery {Number} [limit=20] The number of books per page
 *
 * @apiSuccess {Object[]} books Array of book objects
 * @apiSuccess {string} books.isbn13 The book's ISBN (13-digit)
 * @apiSuccess {string} books.authors The author(s) of the book
 * @apiSuccess {number} books.publication The year the book was published
 * @apiSuccess {string} books.original_title The original title of the book
 * @apiSuccess {string} books.title The current title of the book
 * @apiSuccess {Object} books.ratings The ratings information
 * @apiSuccess {number} books.ratings.average The average rating
 * @apiSuccess {number} books.ratings.count The total number of ratings
 * @apiSuccess {number} books.ratings.rating_1 The number of 1-star ratings
 * @apiSuccess {number} books.ratings.rating_2 The number of 2-star ratings
 * @apiSuccess {number} books.ratings.rating_3 The number of 3-star ratings
 * @apiSuccess {number} books.ratings.rating_4 The number of 4-star ratings
 * @apiSuccess {number} books.ratings.rating_5 The number of 5-star ratings
 * @apiSuccess {Object} books.icons The book cover image URLs
 * @apiSuccess {string} books.icons.large URL to large book cover image
 * @apiSuccess {string} books.icons.small URL to small book cover image
 * @apiSuccess {Number} total Total number of books in the database
 * @apiSuccess {Number} page The current page number
 * @apiSuccess {Number} limit The number of books per page
 *
 * @apiError (500: Database Error) {String} message "Server error - contact support"
 */
messageRouterBook.get('/all', async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    try {
        const totalResult = await pool.query('SELECT COUNT(*) FROM BOOKS');
        const total = parseInt(totalResult.rows[0].count);

        const result = await pool.query(
            `SELECT * FROM BOOKS ORDER BY id LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        const books: IBook[] = result.rows.map((row) => ({
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

        res.json({
            books,
            total,
            page,
            limit,
        });
    } catch (error) {
        console.error('DB Query error on GET all:', error);
        res.status(500).json({
            message: 'Server error - contact support',
        });
    }
});

/**
 * @api {put} /ratings Update a book's rating information
 *
 * @apiDescription Updates one or more rating values (1-star to 5-star), recalculating the total rating count and average rating for a book identified by its 13-digit ISBN.
 *
 * @apiName UpdateBookRatings
 * @apiGroup Book
 *
 * @apiBody {string} isbn13 The 13-digit ISBN of the book to update (required)
 * @apiBody {number} [rating_1_star] Updated count for 1-star ratings
 * @apiBody {number} [rating_2_star] Updated count for 2-star ratings
 * @apiBody {number} [rating_3_star] Updated count for 3-star ratings
 * @apiBody {number} [rating_4_star] Updated count for 4-star ratings
 * @apiBody {number} [rating_5_star] Updated count for 5-star ratings
 *
 * @apiSuccess {String} message Confirmation message: "Ratings updated successfully"
 * @apiSuccess {Object} ratings Updated rating breakdown
 * @apiSuccess {number} ratings.rating_1_star Count of 1-star ratings
 * @apiSuccess {number} ratings.rating_2_star Count of 2-star ratings
 * @apiSuccess {number} ratings.rating_3_star Count of 3-star ratings
 * @apiSuccess {number} ratings.rating_4_star Count of 4-star ratings
 * @apiSuccess {number} ratings.rating_5_star Count of 5-star ratings
 * @apiSuccess {number} ratings.count Total number of ratings
 * @apiSuccess {number} ratings.average Average rating (float)
 *
 * @apiError (400: Invalid ISBN) {String} message "Missing or invalid isbn13"
 * @apiError (404: Not Found) {String} message "Book not found"
 * @apiError (500: Database Error) {String} message "Server error - contact support"
 */
messageRouterBook.put('/ratings', async (req: Request, res: Response) => {
    const { isbn13, rating_1_star, rating_2_star, rating_3_star, rating_4_star, rating_5_star } = req.body;

    if (!isbn13 || !/^\d{13}$/.test(isbn13.toString())) {
        return res.status(400).json({ message: 'Missing or invalid isbn13' });
    }

    try {
        //Get the current ratings
        const result = await pool.query('SELECT * FROM BOOKS WHERE isbn13 = $1', [isbn13]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Book not found' });
        }

        const book = result.rows[0];

        const updatedRatings = {
            rating_1_star: rating_1_star ?? book.rating_1_star,
            rating_2_star: rating_2_star ?? book.rating_2_star,
            rating_3_star: rating_3_star ?? book.rating_3_star,
            rating_4_star: rating_4_star ?? book.rating_4_star,
            rating_5_star: rating_5_star ?? book.rating_5_star,
        };

        const totalRatings =
            updatedRatings.rating_1_star +
            updatedRatings.rating_2_star +
            updatedRatings.rating_3_star +
            updatedRatings.rating_4_star +
            updatedRatings.rating_5_star;

        const averageRating = totalRatings === 0 ? 0 : (
            (
                updatedRatings.rating_1_star * 1 +
                updatedRatings.rating_2_star * 2 +
                updatedRatings.rating_3_star * 3 +
                updatedRatings.rating_4_star * 4 +
                updatedRatings.rating_5_star * 5
            ) / totalRatings
        ).toFixed(2);

        //Update the ratings in the DB
        const updateQuery = `
            UPDATE BOOKS
            SET rating_1_star = $1,
                rating_2_star = $2,
                rating_3_star = $3,
                rating_4_star = $4,
                rating_5_star = $5,
                rating_count = $6,
                rating_avg = $7
            WHERE isbn13 = $8
        `;

        const values = [
            updatedRatings.rating_1_star,
            updatedRatings.rating_2_star,
            updatedRatings.rating_3_star,
            updatedRatings.rating_4_star,
            updatedRatings.rating_5_star,
            totalRatings,
            averageRating,
            isbn13,
        ];

        await pool.query(updateQuery, values);

        res.json({
            message: 'Ratings updated successfully',
            ratings: {
                count: totalRatings,
                average: Number(averageRating),
                ...updatedRatings,
            },
        });
    } catch (error) {
        console.error('DB error on PUT ratings:', error);
        res.status(500).json({ message: 'Server error - contact support' });
    }
});


export { messageRouterBook };
