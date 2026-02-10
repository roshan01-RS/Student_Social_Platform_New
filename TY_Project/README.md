Conify — The Ultimate Student Social Platform
Conify is a specialized, real-time social networking platform designed specifically for students and academic communities.
It combines the structured identity of an academic institution with the dynamic, fast-paced interaction of modern social media.
________________________________________
🚀 Project Overview
Conify bridges the gap between formal education and social interaction by giving students a dedicated ecosystem to:
•	Collaborate in real-time study groups
•	Engage in global discussions via a Twitter-style feed
•	Discover niche communities based on majors or interests
•	Verify student status for a safe and authentic environment
________________________________________
🛠 Tech Stack
Backend
•	Framework: Spring Boot 3.2.3 (Java 21)
•	Messaging: Spring WebSocket with STOMP & SockJS (Real-time features)
•	Security: JWT (JSON Web Tokens) — stateless authentication
•	Build Tool: Gradle
Database (Hybrid Strategy)
SQLite — Identity & Authentication
•	Core user records
•	Registration
•	OTP management
•	Login credentials
MongoDB Atlas — Social Layer
•	Global Posts
•	Comments
•	Nested Replies
•	Group Chats
•	Notification Engine
Frontend
•	Logic: Vanilla JavaScript (Modular ES6 Architecture)
•	Routing: Custom client-side router (routes.js) for dynamic no-reload navigation
•	Styling: CSS3 + CSS Variables (Dark Mode support)
•	PWA: Service Workers for offline capabilities
________________________________________
🌟 Key Features
1. Advanced Authentication & Identity
•	Multi-step registration (college discovery + age verification)
•	Email-based OTP verification
•	Student document verification (ID cards, fee receipts)
•	Admin approval grants Verified Student Status
________________________________________
2. Global Feed
•	Universal post visibility across the network
•	Like, Comment, and Bookmark system
•	Image uploads and emoji support
•	Deep nested threaded discussions
________________________________________
3. Real-Time Communication
•	1-to-1 private messaging
•	Online/Offline presence tracking
•	Typing indicators
•	Instant friend search and adding
•	Group chat clusters
•	Automated system chat messages
(Example: “User A added User B”)
________________________________________
4. Community Hub
•	Discover public communities by category:
o	Technology
o	Arts
o	Startups
o	Academics
•	Join live topic-based chat rooms
________________________________________
5. Notification Engine
•	Real-time alerts for:
o	Likes
o	Comments
o	Friend requests
o	Group activity
•	Animated unread indicators (CSS snake border animation)
________________________________________
📂 Project Structure
TY_Project/
│
├── .vscode/                       # Workspace settings
│
├── Student_Social_Platform/       # Main application root
│   │
│   ├── build.gradle               # Build configuration
│   │
│   ├── src/main/java/com/conify/
│   │   ├── config/                # Security, Mongo, WebSocket configuration
│   │   ├── controller/            # REST & WebSocket endpoints
│   │   ├── dto/                   # Data Transfer Objects
│   │   ├── model/                 # JPA (SQLite) + Mongo entities
│   │   ├── repository/            # Database access layers
│   │   └── service/               # Business logic and presence services
│   │
│   └── src/main/resources/
│       ├── static/                # Frontend SPA
│       │   ├── css/               # Module styling
│       │   ├── js/                # Frontend components
│       │   ├── uploads/           # Profile photos & documents
│       │   └── index.html         # Entry point
│
└── README.md
________________________________________
⚙️ Setup & Installation
Prerequisites
•	JDK 21
•	MongoDB Atlas account (or local MongoDB)
•	Gradle
________________________________________
Configuration
Update src/main/resources/application.properties:
spring.data.mongodb.uri=mongodb+srv://<user>:<pass>@cluster.mongodb.net/conify_db
SQLite requires no setup.
conify.db will be automatically generated.
________________________________________
Run the Application
./gradlew bootRun
Then open:
http://localhost:8000
________________________________________
🔮 Future Roadmap
•	WebRTC video/audio calling
•	AI-based friend recommendations (majors + interests)
•	Student marketplace for books and resources
________________________________________
Developed by Roshan Singh and the Conify Team

