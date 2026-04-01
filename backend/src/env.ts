import path from 'node:path';
import * as dotenv from 'dotenv';

// Load the repo-level runtime config so relay helpers see the same deployment env
// as the bootstrap scripts and frontend.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
