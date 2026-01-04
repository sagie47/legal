import 'dotenv/config';
import { db } from './scripts/db';
import { organizations } from './src/db/schema';

async function main() {
    console.log('Seeding database...');

    try {
        const [org] = await db.insert(organizations).values({
            name: 'Test Organization',
            repName: 'Test Rep'
        }).returning();

        console.log('Created Organization:', org);
    } catch (error) {
        console.error('Error seeding database:', error);
    }

    process.exit(0);
}

main();
