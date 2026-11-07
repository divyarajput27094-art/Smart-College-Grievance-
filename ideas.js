
const express = require("express");
const router = express.Router();
const db = require("./db");
const crypto = require("crypto");

// Submit a new idea
router.post("/", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        const { title, category, description, is_anonymous } = req.body;

        if (!title || !category || !description ||
            !title.trim() || !description.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields"
            });
        }

        const [users] = await db.query(
            `SELECT user_id FROM users
             WHERE user_id = ? AND role = 'student' AND is_active = TRUE`,
            [req.session.userId]
        );

        if (users.length === 0) {
            return res.status(403).json({
                success: false,
                message: "Student account not found or inactive"
            });
        }

        const trackingId = "IDEA-" + Date.now() + "-" +
            crypto.randomBytes(3).toString("hex").toUpperCase();

        await db.query(
            `INSERT INTO student_ideas
            (tracking_id, student_id, title, category, description, is_anonymous)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                trackingId,
                req.session.userId,
                title.trim(),
                category,
                description.trim(),
                is_anonymous ? 1 : 0
            ]
        );

        res.status(201).json({
            success: true,
            message: "Your idea has been submitted successfully!",
            tracking_id: trackingId
        });

    } catch (error) {
        console.error("Idea submission error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to submit your idea"
        });
    }
});

// Get all ideas submitted by logged-in student
router.get("/my", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        const [ideas] = await db.query(
            `SELECT idea_id, tracking_id, title, category, description,
                    is_anonymous, status, admin_remarks,
                    created_at, updated_at
             FROM student_ideas
             WHERE student_id = ?
             ORDER BY created_at DESC`,
            [req.session.userId]
        );

        res.json({
            success: true,
            data: ideas
        });

    } catch (error) {
        console.error("My ideas error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load your ideas"
        });
    }
});
// Track an idea using tracking ID
router.get("/track/:trackingId", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        const trackingId = req.params.trackingId.trim();

        const [ideas] = await db.query(
            `SELECT idea_id, tracking_id, title, category,
                    status, admin_remarks, created_at, updated_at
             FROM student_ideas
             WHERE tracking_id = ? AND student_id = ?`,
            [trackingId, req.session.userId]
        );

        if (ideas.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Idea not found. Please check your Tracking ID."
            });
        }

        res.json({
            success: true,
            idea: ideas[0]
        });

    } catch (error) {
        console.error("Track idea error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to track idea"
        });
    }
});
module.exports = router;
