
const express = require("express");
const crypto = require("crypto");
const db = require("./db");

const router = express.Router();

// SUBMIT NEW COMPLAINT
router.post("/", async (req, res) => {
    let connection;

    try {
        // Check login
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        const {
            department_id,
            category,
            subject,
            description,
            is_anonymous,
            priority
        } = req.body;

        // Validate required fields
        if (!department_id || !category || !subject || !description) {
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields"
            });
        }

        if (!["Low", "Medium", "High"].includes(priority || "Medium")) {
            return res.status(400).json({
                success: false,
                message: "Invalid priority"
            });
        }

        // Verify student account
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

        // Verify department
        const [departments] = await db.query(
            "SELECT department_id FROM departments WHERE department_id = ?",
            [department_id]
        );

        if (departments.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid department"
            });
        }

        const studentId = users[0].user_id;

        const trackingId =
            "SCG-" + Date.now() + "-" +
            crypto.randomBytes(3).toString("hex").toUpperCase();

        connection = await db.getConnection();

        await connection.beginTransaction();

        const [complaint] = await connection.query(
            `INSERT INTO complaints
            (tracking_id, student_id, department_id, category,
             subject, description, is_anonymous, priority)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                trackingId,
                studentId,
                department_id,
                category.trim(),
                subject.trim(),
                description.trim(),
                is_anonymous ? 1 : 0,
                priority || "Medium"
            ]
        );

        // Add complaint history
        await connection.query(
            `INSERT INTO complaint_history
            (complaint_id, old_status, new_status, remarks, updated_by)
            VALUES (?, NULL, 'Submitted',
            'Complaint submitted by student', ?)`,
            [complaint.insertId, studentId]
        );

        await connection.commit();

        res.status(201).json({
            success: true,
            message: "Complaint submitted successfully!",
            tracking_id: trackingId
        });

    } catch (error) {

        if (connection) {
            await connection.rollback();
        }

        console.error("Complaint submission error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to submit complaint"
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// GET MY COMPLAINTS
router.get("/my", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        const [complaints] = await db.query(
            `SELECT
                c.complaint_id,
                c.tracking_id,
                c.category,
                c.subject,
                c.description,
                c.status,
                c.priority,
                c.is_anonymous,
                c.created_at,
                d.department_name
             FROM complaints c
             JOIN departments d
                ON c.department_id = d.department_id
             WHERE c.student_id = ?
             ORDER BY c.created_at DESC`,
            [req.session.userId]
        );

        res.json({
            success: true,
            data: complaints
        });

    } catch (error) {
        console.error("My complaints error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load complaints"
        });
    }
});

// TRACK COMPLAINT BY TRACKING ID
router.get("/track/:trackingId", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        const trackingId = req.params.trackingId.trim();

        const [complaints] = await db.query(
            `SELECT
                c.complaint_id,
                c.tracking_id,
                c.category,
                c.subject,
                c.status,
                c.priority,
                c.created_at,
                c.updated_at,
                d.department_name
             FROM complaints c
             JOIN departments d
                ON c.department_id = d.department_id
             WHERE c.tracking_id = ?
             AND c.student_id = ?`,
            [trackingId, req.session.userId]
        );

        if (complaints.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found. Please check your Tracking ID."
            });
        }

        const complaint = complaints[0];

        const [history] = await db.query(
            `SELECT
                old_status,
                new_status,
                remarks,
                created_at
             FROM complaint_history
             WHERE complaint_id = ?
             ORDER BY created_at ASC`,
            [complaint.complaint_id]
        );

        res.json({
            success: true,
            complaint,
            history
        });

    } catch (error) {
        console.error("Track complaint error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to track complaint"
        });
    }
});


// ADMIN: GET ALL COMPLAINTS
router.get("/admin/all", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        const [admins] = await db.query(
            `SELECT user_id FROM users
             WHERE user_id = ? AND role = 'admin'
             AND is_active = TRUE`,
            [req.session.userId]
        );

        if (admins.length === 0) {
            return res.status(403).json({
                success: false,
                message: "Admin access only"
            });
        }

        const [complaints] = await db.query(`
            SELECT
                c.complaint_id,
                c.tracking_id,
                c.category,
                c.subject,
                c.description,
                c.status,
                c.priority,
                c.is_anonymous,
                c.created_at,
                d.department_name,
                CASE
                    WHEN c.is_anonymous = 1 THEN 'Anonymous Student'
                    ELSE u.full_name
                END AS student_name
            FROM complaints c
            JOIN departments d
                ON c.department_id = d.department_id
            JOIN users u
                ON c.student_id = u.user_id
            ORDER BY c.created_at DESC
        `);

        res.json({
            success: true,
            data: complaints
        });

    } catch (error) {
        console.error("Admin complaints error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load complaints"
        });
    }
});



// ADMIN: GET ALL COMPLAINTS
router.get("/admin/all", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        const [admins] = await db.query(
            `SELECT user_id FROM users
             WHERE user_id = ? AND role = 'admin'
             AND is_active = TRUE`,
            [req.session.userId]
        );

        if (admins.length === 0) {
            return res.status(403).json({
                success: false,
                message: "Admin access only"
            });
        }

        const [complaints] = await db.query(`
            SELECT
                c.complaint_id,
                c.tracking_id,
                c.category,
                c.subject,
                c.description,
                c.status,
                c.priority,
                c.is_anonymous,
                c.created_at,
                d.department_name,
                CASE
                    WHEN c.is_anonymous = 1 THEN 'Anonymous Student'
                    ELSE u.full_name
                END AS student_name
            FROM complaints c
            JOIN departments d
                ON c.department_id = d.department_id
            JOIN users u
                ON c.student_id = u.user_id
            ORDER BY c.created_at DESC
        `);

        res.json({
            success: true,
            data: complaints
        });

    } catch (error) {
        console.error("Admin complaints error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load complaints"
        });
    }
});


// ADMIN: UPDATE COMPLAINT STATUS
router.patch("/admin/:id/status", async (req, res) => {
    let connection;

    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        const [admins] = await db.query(
            `SELECT user_id FROM users
             WHERE user_id = ? AND role = 'admin'
             AND is_active = TRUE`,
            [req.session.userId]
        );

        if (admins.length === 0) {
            return res.status(403).json({
                success: false,
                message: "Admin access only"
            });
        }

        const complaintId = Number(req.params.id);
        const { status, remarks } = req.body;

        const allowedStatuses = [
            "Under Review",
            "In Progress",
            "Resolved",
            "Rejected"
        ];

        if (!Number.isInteger(complaintId) || complaintId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid complaint ID"
            });
        }

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid complaint status"
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [existing] = await connection.query(
            "SELECT status FROM complaints WHERE complaint_id = ?",
            [complaintId]
        );

        if (existing.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Complaint not found"
            });
        }

        const oldStatus = existing[0].status;

        await connection.query(
            `UPDATE complaints
             SET status = ?, assigned_admin_id = ?
             WHERE complaint_id = ?`,
            [status, req.session.userId, complaintId]
        );

        await connection.query(
            `INSERT INTO complaint_history
             (complaint_id, old_status, new_status, remarks, updated_by)
             VALUES (?, ?, ?, ?, ?)`,
            [
                complaintId,
                oldStatus,
                status,
                remarks || "Status updated by admin",
                req.session.userId
            ]
        );

        await connection.commit();

        res.json({
            success: true,
            message: "Complaint status updated successfully",
            status
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Status update error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update complaint status"
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});



module.exports = router;
