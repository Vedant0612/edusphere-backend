/ Run this file separately: node prisma/seed-roadmaps.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedRoadmaps() {
  console.log('🌱 Seeding roadmaps...');

  // Create Web Development Roadmap
  const webDevRoadmap = await prisma.roadmaps.create({
    data: {
      title: 'Full Stack Web Development',
      description: 'Complete roadmap to become a full stack web developer',
      domain: 'Web Development',
      checkpoints: {
        create: [
          {
            title: 'HTML Basics',
            description: 'Learn HTML5 fundamentals and semantic markup',
            resourceType: 'video',
            resourceUrl: 'https://www.youtube.com/watch?v=qz0aGYrrlhU'
          },
          {
            title: 'CSS Fundamentals',
            description: 'Master CSS styling, flexbox, and grid',
            resourceType: 'article',
            resourceUrl: 'https://web.dev/learn/css/'
          },
          {
            title: 'JavaScript Basics',
            description: 'Learn JavaScript fundamentals and ES6+',
            resourceType: 'course',
            resourceUrl: 'https://javascript.info/'
          },
          {
            title: 'React Fundamentals',
            description: 'Build modern UIs with React',
            resourceType: 'video',
            resourceUrl: 'https://react.dev/learn'
          },
          {
            title: 'Node.js & Express',
            description: 'Build backend APIs with Node.js',
            resourceType: 'course',
            resourceUrl: 'https://nodejs.org/en/docs/guides'
          },
          {
            title: 'Database Design (MongoDB/PostgreSQL)',
            description: 'Learn database design and queries',
            resourceType: 'article',
            resourceUrl: 'https://www.postgresql.org/docs/current/tutorial.html'
          }
        ]
      }
    }
  });

  // Create Data Science Roadmap
  const dsRoadmap = await prisma.roadmaps.create({
    data: {
      title: 'Data Science & Machine Learning',
      description: 'Comprehensive path to becoming a data scientist',
      domain: 'Data Science',
      checkpoints: {
        create: [
          {
            title: 'Python Fundamentals',
            description: 'Master Python programming basics',
            resourceType: 'course',
            resourceUrl: 'https://docs.python.org/3/tutorial/'
          },
          {
            title: 'NumPy & Pandas',
            description: 'Data manipulation with NumPy and Pandas',
            resourceType: 'video',
            resourceUrl: 'https://pandas.pydata.org/docs/getting_started/index.html'
          },
          {
            title: 'Data Visualization',
            description: 'Matplotlib, Seaborn, and Plotly',
            resourceType: 'article',
            resourceUrl: 'https://matplotlib.org/stable/tutorials/index.html'
          },
          {
            title: 'Machine Learning Basics',
            description: 'Supervised and unsupervised learning',
            resourceType: 'course',
            resourceUrl: 'https://scikit-learn.org/stable/tutorial/index.html'
          },
          {
            title: 'Deep Learning with TensorFlow',
            description: 'Neural networks and deep learning',
            resourceType: 'video',
            resourceUrl: 'https://www.tensorflow.org/tutorials'
          }
        ]
      }
    }
  });

  // Create Mobile Development Roadmap
  const mobileRoadmap = await prisma.roadmaps.create({
    data: {
      title: 'Mobile App Development',
      description: 'Learn to build Android and iOS applications',
      domain: 'Mobile Development',
      checkpoints: {
        create: [
          {
            title: 'React Native Basics',
            description: 'Introduction to React Native',
            resourceType: 'course',
            resourceUrl: 'https://reactnative.dev/docs/getting-started'
          },
          {
            title: 'Mobile UI/UX Design',
            description: 'Design principles for mobile apps',
            resourceType: 'article',
            resourceUrl: 'https://material.io/design'
          },
          {
            title: 'State Management (Redux)',
            description: 'Managing app state effectively',
            resourceType: 'video',
            resourceUrl: 'https://redux.js.org/tutorials/essentials/part-1-overview-concepts'
          },
          {
            title: 'API Integration',
            description: 'Connect to REST APIs and handle data',
            resourceType: 'course',
            resourceUrl: 'https://reactnative.dev/docs/network'
          },
          {
            title: 'App Deployment',
            description: 'Publishing to App Store and Play Store',
            resourceType: 'article',
            resourceUrl: 'https://reactnative.dev/docs/publishing-to-app-store'
          }
        ]
      }
    }
  });

  // Create DevOps Roadmap
  const devopsRoadmap = await prisma.roadmaps.create({
    data: {
      title: 'DevOps Engineering',
      description: 'Master modern DevOps practices and tools',
      domain: 'DevOps',
      checkpoints: {
        create: [
          {
            title: 'Linux Fundamentals',
            description: 'Master Linux command line and administration',
            resourceType: 'course',
            resourceUrl: 'https://www.linux.org/pages/download/'
          },
          {
            title: 'Version Control (Git)',
            description: 'Git workflows and best practices',
            resourceType: 'article',
            resourceUrl: 'https://git-scm.com/book/en/v2'
          },
          {
            title: 'Docker Containers',
            description: 'Containerization with Docker',
            resourceType: 'video',
            resourceUrl: 'https://docs.docker.com/get-started/'
          },
          {
            title: 'CI/CD Pipelines',
            description: 'Automated testing and deployment',
            resourceType: 'course',
            resourceUrl: 'https://docs.github.com/en/actions'
          },
          {
            title: 'Cloud Platforms (AWS/Azure)',
            description: 'Deploy applications to the cloud',
            resourceType: 'article',
            resourceUrl: 'https://aws.amazon.com/getting-started/'
          }
        ]
      }
    }
  });

  console.log('✅ Roadmaps seeded successfully!');
  console.log(`- ${webDevRoadmap.title}`);
  console.log(`- ${dsRoadmap.title}`);
  console.log(`- ${mobileRoadmap.title}`);
  console.log(`- ${devopsRoadmap.title}`);
}

seedRoadmaps()
  .catch((e) => {
    console.error('❌ Error seeding roadmaps:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });