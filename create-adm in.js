const db = require("./config/db");
const bcrypt = require("bcryptjs");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => {
        rl.question(question, resolve);
    });
}

async function createAdmin() {
    try {
        console.log("\n===== CREATE ADMIN ACCOUNT =====\n");

        const fullName = await ask("Admin Name: ");
        const enrollment = await ask("Admin Login ID: ");
        const email = await ask("Admin Email: ");
        const password = await ask("Admin Password: ");

        if (!fullName.trim() || !enrollment.trim() ||
            !email.trim() || !password) {
            console.log("All fields are required.");
            return;
        }

        const [existing] = await db.query(
            "SELECT user_id FROM users WHERE enrollment_number = ? OR email = ?",
            [enrollment.trim(), email.trim()]
        );

        if (existing.length > 0) {
            console.log("This Login ID or Email already exists.");
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            `INSERT INTO users
            (full_name, enrollment_number, email, password_hash, role, is_active)
            VALUES (?, ?, ?, ?, 'admin', TRUE)`,
            [fullName.trim(), enrollment.trim(), email.trim(), hashedPassword]
        );

        console.log("\nAdmin account created successfully!");

    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        rl.close();
        await db.end();
    }
}

createAdmin();