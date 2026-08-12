export const globalErrorHandler = (
    err,req,res, next
) => {
    // Log internal error in English
    console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    console.error(err.message);
    console.error(err.stack);

    // Default localized error to client
    let statusCode = 500;
    let message = 'Error interno del servidor';

    // Handle specific known auth errors thrown by service
    if (err.message === 'Invalid credentials') {
        statusCode = 401;
        message = 'Credenciales inválidas';
    } else if (err.message === 'User already exists') {
        statusCode = 409;
        message = 'El usuario ya existe';
    }

    res.status(statusCode).json({
        error: message,
    });
};
