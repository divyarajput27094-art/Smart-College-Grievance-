
CREATE DATABASE IF NOT EXISTS smart_college_grievance;

USE smart_college_grievance;

-- 1. Departments
CREATE TABLE departments (
    department_id INT AUTO_INCREMENT PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO departments (department_name) VALUES
('Computer Science'),
('Information Technology'),
('Electronics'),
('Mechanical'),
('Civil'),
('Electrical'),
('Administration'),
('Hostel'),
('Library'),
('Other');

-- 2. Users
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    enrollment_number VARCHAR(30) UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,

    role ENUM('student', 'admin')
    NOT NULL DEFAULT 'student',

    department_id INT,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (department_id)
    REFERENCES departments(department_id)
);

-- 3. Complaints
CREATE TABLE complaints (
    complaint_id INT AUTO_INCREMENT PRIMARY KEY,

    tracking_id VARCHAR(30) NOT NULL UNIQUE,

    student_id INT NOT NULL,
    department_id INT NOT NULL,

    category VARCHAR(100) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,

    is_anonymous BOOLEAN DEFAULT FALSE,

    status ENUM(
        'Submitted',
        'Under Review',
        'In Progress',
        'Resolved',
        'Rejected'
    ) DEFAULT 'Submitted',

    priority ENUM(
        'Low',
        'Medium',
        'High'
    ) DEFAULT 'Medium',

    assigned_admin_id INT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id)
    REFERENCES users(user_id),

    FOREIGN KEY (department_id)
    REFERENCES departments(department_id),

    FOREIGN KEY (assigned_admin_id)
    REFERENCES users(user_id)
);

-- 4. Complaint Status History
CREATE TABLE complaint_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,

    complaint_id INT NOT NULL,

    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,

    remarks TEXT,

    updated_by INT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (complaint_id)
    REFERENCES complaints(complaint_id),

    FOREIGN KEY (updated_by)
    REFERENCES users(user_id)
);

-- 5. Student Feedback
CREATE TABLE feedback (
    feedback_id INT AUTO_INCREMENT PRIMARY KEY,

    complaint_id INT NOT NULL UNIQUE,
    student_id INT NOT NULL,

    rating INT NOT NULL,
    comments TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (complaint_id)
    REFERENCES complaints(complaint_id),

    FOREIGN KEY (student_id)
    REFERENCES users(user_id),

    CHECK (rating BETWEEN 1 AND 5)
);

-- 6. Complaint Attachments
CREATE TABLE complaint_attachments (
    attachment_id INT AUTO_INCREMENT PRIMARY KEY,

    complaint_id INT NOT NULL,

    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,

    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (complaint_id)
    REFERENCES complaints(complaint_id)
);
