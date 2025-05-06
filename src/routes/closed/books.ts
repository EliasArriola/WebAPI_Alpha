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
 * @apiDefine JWT
 * @apiHeader {String} Authorization The string "Bearer " + a valid JSON Web Token (JWT).
 */

/**
 * @api {post} /book Request to add a new book
 *
 * @apiDescription Request to add a book to the database with all required fields
 *
 * @apiName PostBook
 * @apiGroup Book
 * 
 * @apiUse JWT
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
 * @apiError (400: Duplicate ISBN) {String} message "ISBN13 already exists"
 * @apiError (401: Unauthorized) {String} message "Auth token is not supplied"
 * @apiError (403: Forbidden) {String} message "Token is not valid"
 * @apiError (500: Database Error) {String} message "Failed to insert book: (Error message)"
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
 * @apiDescription Request to retrieve a book from the database using its 13-digit ISBN number.
 * The ISBN must be provided as a query parameter. The route will return a structured book object
 * containing all metadata, ratings, and image URLs. This route is protected by JWT authentication.
 *
 * @apiName GetBookByISBN
 * @apiGroup Book
 * 
 * @apiUse JWT
 *
 * @apiQuery {string} isbn The 13-digit ISBN to search for. Must be passed as a query parameter. If not provided or invalid, a 400 error is returned.
 *
 * @apiSuccess {Object} book The book object associated with the requested ISBN
 * @apiSuccess {string} book.isbn13 The book's 13-digit ISBN
 * @apiSuccess {string} book.authors The author(s) of the book
 * @apiSuccess {number} book.publication The year the book was published
 * @apiSuccess {string} book.original_title The original title of the book
 * @apiSuccess {string} book.title The current (possibly localized) title of the book
 * @apiSuccess {Object} book.ratings The ratings breakdown
 * @apiSuccess {number} book.ratings.average The average rating score
 * @apiSuccess {number} book.ratings.count Total number of ratings
 * @apiSuccess {number} book.ratings.rating_1 Count of 1-star ratings
 * @apiSuccess {number} book.ratings.rating_2 Count of 2-star ratings
 * @apiSuccess {number} book.ratings.rating_3 Count of 3-star ratings
 * @apiSuccess {number} book.ratings.rating_4 Count of 4-star ratings
 * @apiSuccess {number} book.ratings.rating_5 Count of 5-star ratings
 * @apiSuccess {Object} book.icons The book cover image URLs
 * @apiSuccess {string} book.icons.large URL to the large book cover image
 * @apiSuccess {string} book.icons.small URL to the small book cover image
 *
 * @apiError (400: Missing Parameter) {String} message "Missing required query parameter: isbn"
 * @apiError (404: Book Not Found) {String} message "No book found with ISBN [isbn]"
 * @apiError (401: Unauthorized) {String} message "Auth token is not supplied"
 * @apiError (403: Forbidden) {String} message "Token is not valid"
 * @apiError (500: Database Error) {String} message "Server error - contact support"
 * @apiUse JSONError
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
 * @api {get} /author Request to retrieve books by author name
 *
 * @apiDescription Request to retrieve all books that match a specified author or partial author name.
 * The author name must be provided as a query parameter. Returns a list of all matching book objects
 * with full metadata, rating breakdowns, and image links. This route is protected by JWT authentication.
 *
 * @apiName GetBooksByAuthor
 * @apiGroup Book
 * 
 * @apiUse JWT
 *
 * @apiQuery {string} authors The author name or partial name to search for. Matching is case-insensitive and performed using SQL ILIKE.
 *
 * @apiSuccess {Object[]} books Array of book objects that match the given author name
 * @apiSuccess {string} books.isbn13 The 13-digit ISBN string of the book
 * @apiSuccess {string} books.authors The author(s) of the book
 * @apiSuccess {number} books.publication The year the book was published
 * @apiSuccess {string} books.original_title The original title of the book
 * @apiSuccess {string} books.title The current (possibly localized) title of the book
 * @apiSuccess {Object} books.ratings Rating metadata for the book
 * @apiSuccess {number} books.ratings.average Average rating value
 * @apiSuccess {number} books.ratings.count Total number of ratings
 * @apiSuccess {number} books.ratings.rating_1 Count of 1-star ratings
 * @apiSuccess {number} books.ratings.rating_2 Count of 2-star ratings
 * @apiSuccess {number} books.ratings.rating_3 Count of 3-star ratings
 * @apiSuccess {number} books.ratings.rating_4 Count of 4-star ratings
 * @apiSuccess {number} books.ratings.rating_5 Count of 5-star ratings
 * @apiSuccess {Object} books.icons Object containing image URLs for the book cover
 * @apiSuccess {string} books.icons.large URL to the large cover image
 * @apiSuccess {string} books.icons.small URL to the small cover image
 *
 * @apiError (400: Missing Parameter) {String} message "Missing required query parameter: authors"
 * @apiError (404: No Books Found) {String} message "No book found with authors [authors]"
 * @apiError (401: Unauthorized) {String} message "Auth token is not supplied"
 * @apiError (403: Forbidden) {String} message "Token is not valid"
 * @apiError (500: Database Error) {String} message "Server error - contact support"
 * @apiUse JSONError
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
 * @api {get} /title Request to retrieve books by title
 *
 * @apiDescription Retrieves one or more books that match a full or partial title (case-insensitive).
 *
 * @apiName GetBooksByTitle
 * @apiGroup Book
 *
 * @apiUse JWT
 *
 * @apiQuery {string} title The book title or partial title to search for (required)
 *
 * @apiSuccess {Object[]} books Array of book objects that matched the title
 * @apiSuccess {string} books.isbn13 The book's ISBN (13-digit)
 * @apiSuccess {string} books.authors The author(s) of the book
 * @apiSuccess {number} books.publication The year the book was published
 * @apiSuccess {string} books.original_title The original title of the book
 * @apiSuccess {string} books.title The current title of the book
 * @apiSuccess {Object} books.ratings Ratings breakdown and stats
 * @apiSuccess {Object} books.icons Image URLs for the book cover
 *
 * @apiError (400: Missing Parameter) {String} message "Missing required query parameter: title"
 * @apiError (404: Not Found) {String} message "No book found with title matching [title]"
 * @apiError (500: Database Error) {String} message "Server error - contact support"
 */
messageRouterBook.get('/title', async (request: Request, response: Response) => {
    const title = request.query.title;

    // Validate title exists and is a string
    if (!title || typeof title !== 'string') {
        return response.status(400).json({
            message: 'Missing required query parameter: title',
        });
    }

    const theQuery = `
        SELECT * FROM BOOKS WHERE title ILIKE $1
    `;
    const values = [`%${title}%`];

    try {
        const result = await pool.query(theQuery, values);

        if (result.rowCount === 0) {
            return response.status(404).json({
                message: `No book found with title matching "${title}"`,
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
        console.error('DB Query error on GET by Title:', error);
        response.status(500).json({
            message: 'Server error - contact support',
        });
    }
});

/**
 * @api {get} /ratings/min Request books by minimum average rating
 * 
 * @apiDescription Retrieves books that have an average rating greater than or equal to the specified minimum rating. Results are paginated.
 *
 * @apiName GetBooksByMinRating
 * @apiGroup Book
 *
 * @apiUse JWT
 *
 * @apiQuery {Number} min_rating Minimum average rating (defaults to 1 if invalid). Clamped between 1 and 5.
 * @apiQuery {Number} [page=1] Page number to retrieve.
 * @apiQuery {Number} [limit=20] Number of books per page.
 *
 * @apiSuccess {Number} min_rating The clamped rating threshold used in the query.
 * @apiSuccess {Number} total Total number of books matching the query.
 * @apiSuccess {Number} page The current page number.
 * @apiSuccess {Number} limit The number of results per page.
 * @apiSuccess {Object[]} books Array of book objects matching the filter.
 * @apiSuccess {string} books.isbn13 The 13-digit ISBN of the book
 * @apiSuccess {string} books.authors The author(s) of the book
 * @apiSuccess {number} books.publication The year the book was published
 * @apiSuccess {string} books.original_title The original title of the book
 * @apiSuccess {string} books.title The current (possibly localized) title of the book
 * @apiSuccess {Object} books.ratings Rating breakdown for the book
 * @apiSuccess {number} books.ratings.average Average rating value
 * @apiSuccess {number} books.ratings.count Total number of ratings
 * @apiSuccess {number} books.ratings.rating_1 Count of 1-star ratings
 * @apiSuccess {number} books.ratings.rating_2 Count of 2-star ratings
 * @apiSuccess {number} books.ratings.rating_3 Count of 3-star ratings
 * @apiSuccess {number} books.ratings.rating_4 Count of 4-star ratings
 * @apiSuccess {number} books.ratings.rating_5 Count of 5-star ratings
 * @apiSuccess {Object} books.icons Book image URLs
 * @apiSuccess {string} books.icons.large URL to the large book cover image
 * @apiSuccess {string} books.icons.small URL to the small book cover image
 *
 * @apiError (404: Not Found) {String} message "No books found with average rating >= [min_rating]"
 * @apiError (500: Database Error) {String} message "Server error - contact support"
 */

messageRouterBook.get('/ratings/min', async (req: Request, res: Response) => {
    const rawMinRating = parseFloat(req.query.min_rating as string);
    const rawPage = parseInt(req.query.page as string);
    const rawLimit = parseInt(req.query.limit as string);

    // Clamp and validate min rating
    let minRating = isNaN(rawMinRating) ? 1 : rawMinRating;
    if (minRating < 1) minRating = 1;
    if (minRating > 5) minRating = 5;

    const page = !isNaN(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = !isNaN(rawLimit) && rawLimit > 0 ? rawLimit : 20;
    const offset = (page - 1) * limit;

    const query = `
        SELECT * FROM BOOKS
        WHERE rating_avg >= $1
        ORDER BY rating_avg DESC
        LIMIT $2 OFFSET $3
    `;

    const countQuery = `SELECT COUNT(*) FROM BOOKS WHERE rating_avg >= $1`;

    try {
        const totalResult = await pool.query(countQuery, [minRating]);
        const total = parseInt(totalResult.rows[0].count);

        const result = await pool.query(query, [minRating, limit, offset]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: `No books found with average rating >= ${minRating}`,
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

        res.json({
            min_rating: minRating,
            total,
            page,
            limit,
            books,
        });
    } catch (error) {
        console.error('DB Query error on GET ratings/min:', error);
        res.status(500).json({
            message: 'Server error - contact support',
        });
    }
});

/**
 * @api {get} /year Request books by publication year range
 *
 * @apiDescription Retrieves books published between a given range of years (inclusive).
 * Defaults to earliest/future-safe bounds if invalid or missing. Results are paginated.
 *
 * @apiName GetBooksByYearRange
 * @apiGroup Book
 *
 * @apiUse JWT
 *
 * @apiQuery {Number} [min=1450] Minimum publication year (defaults to 1450 if missing or invalid).
 * @apiQuery {Number} [max=currentYear+2] Maximum publication year (defaults to current year + 2 if missing or invalid).
 * @apiQuery {Number} [page=1] Page number to retrieve.
 * @apiQuery {Number} [limit=20] Number of results per page.
 *
 * @apiSuccess {Number} min_year The clamped minimum year used in the query.
 * @apiSuccess {Number} max_year The clamped maximum year used in the query.
 * @apiSuccess {Number} total Total number of books matching the range.
 * @apiSuccess {Number} page The current page number.
 * @apiSuccess {Number} limit The number of results per page.
 * @apiSuccess {Object[]} books Array of book objects published within the range.
 * @apiSuccess {string} books.isbn13 The 13-digit ISBN of the book
 * @apiSuccess {string} books.authors The author(s) of the book
 * @apiSuccess {number} books.publication The year the book was published
 * @apiSuccess {string} books.original_title The original title of the book
 * @apiSuccess {string} books.title The current (possibly localized) title of the book
 * @apiSuccess {Object} books.ratings Rating breakdown for the book
 * @apiSuccess {number} books.ratings.average Average rating value
 * @apiSuccess {number} books.ratings.count Total number of ratings
 * @apiSuccess {number} books.ratings.rating_1 Count of 1-star ratings
 * @apiSuccess {number} books.ratings.rating_2 Count of 2-star ratings
 * @apiSuccess {number} books.ratings.rating_3 Count of 3-star ratings
 * @apiSuccess {number} books.ratings.rating_4 Count of 4-star ratings
 * @apiSuccess {number} books.ratings.rating_5 Count of 5-star ratings
 * @apiSuccess {Object} books.icons Book image URLs
 * @apiSuccess {string} books.icons.large URL to the large book cover image
 * @apiSuccess {string} books.icons.small URL to the small book cover image
 *
 * @apiError (404: Not Found) {String} message "No books found between years [min] and [max]"
 * @apiError (500: Database Error) {String} message "Server error - contact support"
 */
messageRouterBook.get('/year', async (req: Request, res: Response) => {
    const rawMin = parseInt(req.query.min as string);
    const rawMax = parseInt(req.query.max as string);
    const rawPage = parseInt(req.query.page as string);
    const rawLimit = parseInt(req.query.limit as string);

    //Year boundaries to prevent overflow or bad queries
    const EARLIEST_YEAR = 1450; //printing press era
    const LATEST_YEAR = new Date().getFullYear() + 2; //slight buffer for future pub dates

    const minYear = !isNaN(rawMin) && rawMin >= EARLIEST_YEAR ? rawMin : EARLIEST_YEAR;
    const maxYear = !isNaN(rawMax) && rawMax <= LATEST_YEAR ? rawMax : LATEST_YEAR;

    const page = !isNaN(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = !isNaN(rawLimit) && rawLimit > 0 ? rawLimit : 20;
    const offset = (page - 1) * limit;

    const query = `
        SELECT * FROM BOOKS
        WHERE publication_year BETWEEN $1 AND $2
        ORDER BY publication_year DESC
        LIMIT $3 OFFSET $4
    `;

    const countQuery = `
        SELECT COUNT(*) FROM BOOKS
        WHERE publication_year BETWEEN $1 AND $2
    `;

    try {
        const totalResult = await pool.query(countQuery, [minYear, maxYear]);
        const total = parseInt(totalResult.rows[0].count);

        const result = await pool.query(query, [minYear, maxYear, limit, offset]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: `No books found between years ${minYear} and ${maxYear}`,
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

        res.json({
            min_year: minYear,
            max_year: maxYear,
            total,
            page,
            limit,
            books,
        });
    } catch (error) {
        console.error('DB Query error on GET by publication year:', error);
        res.status(500).json({
            message: 'Server error - contact support',
        });
    }
});

/**
 * @api {get} /all Request to retrieve all books with pagination
 *
 * @apiDescription Retrieves a paginated list of all books in the database. This route uses SQL OFFSET-based pagination and allows you to control the number of book records returned per page via query parameters.
 * This route is protected by JWT authentication.
 *
 * @apiName GetAllBooks
 * @apiGroup Book
 * 
 * @apiUse JWT
 *
 * @apiQuery {Number} [page=1] The page number to retrieve. Must be a positive number. If omitted, defaults to 1.
 * @apiQuery {Number} [limit=20] The number of books per page. Must be a positive number. If omitted, defaults to 20.
 *
 * @apiSuccess {Object[]} books Array of book objects for the requested page
 * @apiSuccess {string} books.isbn13 The 13-digit ISBN of the book
 * @apiSuccess {string} books.authors The author(s) of the book
 * @apiSuccess {number} books.publication The year the book was published
 * @apiSuccess {string} books.original_title The original title of the book
 * @apiSuccess {string} books.title The current (possibly localized) title of the book
 * @apiSuccess {Object} books.ratings Rating breakdown for the book
 * @apiSuccess {number} books.ratings.average Average rating value
 * @apiSuccess {number} books.ratings.count Total number of ratings
 * @apiSuccess {number} books.ratings.rating_1 Count of 1-star ratings
 * @apiSuccess {number} books.ratings.rating_2 Count of 2-star ratings
 * @apiSuccess {number} books.ratings.rating_3 Count of 3-star ratings
 * @apiSuccess {number} books.ratings.rating_4 Count of 4-star ratings
 * @apiSuccess {number} books.ratings.rating_5 Count of 5-star ratings
 * @apiSuccess {Object} books.icons Book image URLs
 * @apiSuccess {string} books.icons.large URL to the large book cover image
 * @apiSuccess {string} books.icons.small URL to the small book cover image
 *
 * @apiSuccess {Number} total Total number of books in the database
 * @apiSuccess {Number} page The current page number used in the query
 * @apiSuccess {Number} limit The number of books returned per page
 *
 * @apiError (401: Unauthorized) {String} message "Auth token is not supplied"
 * @apiError (403: Forbidden) {String} message "Token is not valid"
 * @apiError (500: Database Error) {String} message "Server error - contact support"
 * @apiUse JSONError
 */
messageRouterBook.get('/all', async (req: Request, res: Response) => {
    const rawPage = parseInt(req.query.page as string);
    const rawLimit = parseInt(req.query.limit as string);

    const page = !isNaN(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = !isNaN(rawLimit) && rawLimit > 0 ? rawLimit : 20;
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
 * @api {put} /ratings Request to update a book's rating breakdown
 *
 * @apiDescription Updates one or more rating fields (1-star through 5-star) for a book identified by its 13-digit ISBN.
 * After updating, the route recalculates the total number of ratings and the new average rating.
 * All fields not provided will retain their existing values. This route is protected by JWT authentication.
 *
 * @apiName UpdateBookRatings
 * @apiGroup Book
 * 
 * @apiUse JWT
 *
 * @apiBody {string{13}} isbn13 The 13-digit ISBN of the book to update (required). If missing or invalid, the request will be rejected.
 * @apiBody {number} [rating_1_star] Updated count of 1-star ratings
 * @apiBody {number} [rating_2_star] Updated count of 2-star ratings
 * @apiBody {number} [rating_3_star] Updated count of 3-star ratings
 * @apiBody {number} [rating_4_star] Updated count of 4-star ratings
 * @apiBody {number} [rating_5_star] Updated count of 5-star ratings
 *
 * @apiSuccess {String} message Confirmation message: "Ratings updated successfully"
 * @apiSuccess {Object} ratings Updated ratings object
 * @apiSuccess {number} ratings.rating_1_star Final count of 1-star ratings
 * @apiSuccess {number} ratings.rating_2_star Final count of 2-star ratings
 * @apiSuccess {number} ratings.rating_3_star Final count of 3-star ratings
 * @apiSuccess {number} ratings.rating_4_star Final count of 4-star ratings
 * @apiSuccess {number} ratings.rating_5_star Final count of 5-star ratings
 * @apiSuccess {number} ratings.count Total number of all ratings combined
 * @apiSuccess {number} ratings.average Calculated average rating score (float)
 *
 * @apiError (400: Invalid ISBN) {String} message "Missing or invalid isbn13"
 * @apiError (404: Not Found) {String} message "Book not found"
 * @apiError (401: Unauthorized) {String} message "Auth token is not supplied"
 * @apiError (403: Forbidden) {String} message "Token is not valid"
 * @apiError (500: Database Error) {String} message "Server error - contact support"
 * @apiUse JSONError
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
