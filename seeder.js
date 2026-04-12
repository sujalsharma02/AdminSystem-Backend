const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const employees = [
    {
        "firstName": "Kaustubh",
        "email": "e@e.com",
        "password": "123",
        "role": "employee",
        "taskCounts": {
            "active": 2,
            "newTask": 1,
            "completed": 1,
            "failed": 0
        },
        "tasks": [
            {
                "active": true,
                "newTask": true,
                "completed": false,
                "failed": false,
                "taskTitle": "Update website",
                "taskDescription": "Revamp the homepage design",
                "taskDate": "2024-10-12",
                "category": "Design"
            },
            {
                "active": false,
                "newTask": false,
                "completed": true,
                "failed": false,
                "taskTitle": "Client meeting",
                "taskDescription": "Discuss project requirements",
                "taskDate": "2024-10-10",
                "category": "Meeting"
            },
            {
                "active": true,
                "newTask": false,
                "completed": false,
                "failed": false,
                "taskTitle": "Fix bugs",
                "taskDescription": "Resolve bugs reported in issue tracker",
                "taskDate": "2024-10-14",
                "category": "Development"
            }
        ]
    },
    {
        "firstName": "Aayush",
        "email": "employee2@example.com",
        "password": "123",
        "role": "employee",
        "taskCounts": {
            "active": 1,
            "newTask": 0,
            "completed": 1,
            "failed": 0
        },
        "tasks": [
            {
                "active": true,
                "newTask": false,
                "completed": false,
                "failed": false,
                "taskTitle": "Database optimization",
                "taskDescription": "Optimize queries for better performance",
                "taskDate": "2024-10-11",
                "category": "Database"
            },
            {
                "active": false,
                "newTask": false,
                "completed": true,
                "failed": false,
                "taskTitle": "Design new feature",
                "taskDescription": "Create mockups for the new feature",
                "taskDate": "2024-10-09",
                "category": "Design"
            }
        ]
    },
    {
        "firstName": "Karan",
        "email": "employee3@example.com",
        "password": "123",
        "role": "employee",
        "taskCounts": {
            "active": 2,
            "newTask": 1,
            "completed": 1,
            "failed": 0
        },
        "tasks": [
            {
                "active": true,
                "newTask": true,
                "completed": false,
                "failed": false,
                "taskTitle": "Prepare presentation",
                "taskDescription": "Prepare slides for upcoming client presentation",
                "taskDate": "2024-10-13",
                "category": "Presentation"
            },
            {
                "active": true,
                "newTask": false,
                "completed": false,
                "failed": false,
                "taskTitle": "Code review",
                "taskDescription": "Review the codebase for optimization",
                "taskDate": "2024-10-12",
                "category": "Development"
            },
            {
                "active": false,
                "newTask": false,
                "completed": true,
                "failed": false,
                "taskTitle": "Testing",
                "taskDescription": "Test the latest build for bugs",
                "taskDate": "2024-10-08",
                "category": "QA"
            }
        ]
    },
    {
        "firstName": "Faiz",
        "email": "employee4@example.com",
        "password": "123",
        "role": "employee",
        "taskCounts": {
            "active": 2,
            "newTask": 1,
            "completed": 0,
            "failed": 0
        },
        "tasks": [
            {
                "active": true,
                "newTask": true,
                "completed": false,
                "failed": false,
                "taskTitle": "Write documentation",
                "taskDescription": "Update the project documentation",
                "taskDate": "2024-10-13",
                "category": "Documentation"
            },
            {
                "active": true,
                "newTask": false,
                "completed": false,
                "failed": false,
                "taskTitle": "Set up CI/CD",
                "taskDescription": "Implement continuous integration pipeline",
                "taskDate": "2024-10-11",
                "category": "DevOps"
            }
        ]
    },
    {
        "firstName": "Swayam",
        "email": "employee5@example.com",
        "password": "123",
        "role": "employee",
        "taskCounts": {
            "active": 2,
            "newTask": 1,
            "completed": 1,
            "failed": 0
        },
        "tasks": [
            {
                "active": true,
                "newTask": true,
                "completed": false,
                "failed": false,
                "taskTitle": "UI redesign",
                "taskDescription": "Redesign the user interface for better UX",
                "taskDate": "2024-10-14",
                "category": "Design"
            },
            {
                "active": false,
                "newTask": false,
                "completed": true,
                "failed": false,
                "taskTitle": "Deploy new build",
                "taskDescription": "Deploy the latest build to production",
                "taskDate": "2024-10-09",
                "category": "DevOps"
            },
            {
                "active": true,
                "newTask": false,
                "completed": false,
                "failed": false,
                "taskTitle": "Client feedback",
                "taskDescription": "Gather feedback from clients after product launch",
                "taskDate": "2024-10-12",
                "category": "Support"
            }
        ]
    }
];

const admin = {
    "firstName": "Admin",
    "email": "admin@example.com",
    "password": "123",
    "role": "admin"
};

const importData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        await User.deleteMany();

        // Use create instead of insertMany to trigger pre-save hooks (hashing passwords)
        await User.create(employees);
        await User.create(admin);

        console.log('Data Imported!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

importData();
