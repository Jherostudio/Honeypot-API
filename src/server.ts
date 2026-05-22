import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
// Modifica estas dos líneas quitando el ".js" del final:
import { honeypotInterceptor } from './middlewares/interceptor';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Inyección del guardián del Honeypot
app.use(honeypotInterceptor);

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'operational', timestamp: new Date().toISOString() });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(`[SECURITY ALERT] Unhandled exception: ${err.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
    console.log(`[+] ShadowREST Core running securely on port ${PORT}`);
});