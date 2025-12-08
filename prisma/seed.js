// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const { randomBytes, createHmac } = require('node:crypto');

const prisma = new PrismaClient();

const INSTITUTIONS = [
  { instituteName: "IIIT Nagpur", domain: "iiitn.ac.in", state: "Maharashtra", city: "Nagpur" },
  { instituteName: "IIT Bombay", domain: "iitb.ac.in", state: "Maharashtra", city: "Mumbai" },
  { instituteName: "NIT Warangal", domain: "nitw.ac.in", state: "Telangana", city: "Warangal" },
  { instituteName: "Delhi Technological University", domain: "dtu.ac.in", state: "Delhi", city: "Delhi" },
  { instituteName: "Anna University", domain: "annauniv.edu", state: "Tamil Nadu", city: "Chennai" },
  { instituteName: "Jawaharlal Nehru University", domain: "jnu.ac.in", state: "Delhi", city: "Delhi" },
  { instituteName: "University of Hyderabad", domain: "uohyd.ac.in", state: "Telangana", city: "Hyderabad" },
  { instituteName: "IIM Ahmedabad", domain: "iima.ac.in", state: "Gujarat", city: "Ahmedabad" },
  { instituteName: "BITS Pilani", domain: "bits-pilani.ac.in", state: "Rajasthan", city: "Pilani" },
  { instituteName: "SRM Institute of Science and Technology", domain: "srmist.edu.in", state: "Tamil Nadu", city: "Chennai" },
  { instituteName: "Vellore Institute of Technology", domain: "vit.ac.in", state: "Tamil Nadu", city: "Vellore" },
  { instituteName: "Manipal Academy of Higher Education", domain: "manipal.edu", state: "Karnataka", city: "Manipal" },
  { instituteName: "Christ University", domain: "christuniversity.in", state: "Karnataka", city: "Bangalore" },
  { instituteName: "Banaras Hindu University", domain: "bhu.ac.in", state: "Uttar Pradesh", city: "Varanasi" },
  { instituteName: "University of Calcutta", domain: "caluniv.ac.in", state: "West Bengal", city: "Kolkata" },
  { instituteName: "Jamia Millia Islamia", domain: "jmi.ac.in", state: "Delhi", city: "Delhi" },
  { instituteName: "Amity University", domain: "amity.edu", state: "Uttar Pradesh", city: "Noida" },
  { instituteName: "Symbiosis Institute of Technology", domain: "sitpune.edu.in", state: "Maharashtra", city: "Pune" },
  { instituteName: "Presidency College", domain: "presidencycollegechennai.ac.in", state: "Tamil Nadu", city: "Chennai" },
  { instituteName: "Osmania University", domain: "osmania.ac.in", state: "Telangana", city: "Hyderabad" },
  { instituteName: "Thapar Institute of Engineering and Technology", domain: "thapar.edu", state: "Punjab", city: "Patiala" },
  { instituteName: "Savitribai Phule Pune University", domain: "unipune.ac.in", state: "Maharashtra", city: "Pune" },
  { instituteName: "Vardhaman College of Engineering", domain: "vardhaman.org", state: "Telangana", city: "Hyderabad" },
];

async function main() {
  console.log('🌱 Starting database seed...');

  // Create a super admin user first (needed for institution creation)
  const salt = randomBytes(16).toString('hex');
  const hash = createHmac('sha256', salt)
    .update('password123')
    .digest('hex');

  let superAdmin = await prisma.users.findFirst({
    where: { role: 'superAdmin' }
  });

  if (!superAdmin) {
    superAdmin = await prisma.users.create({
      data: {
        displayName: 'Super Admin',
        email: 'admin@edusphere.com',
        role: 'superAdmin',
        hashPassword: hash,
        salt,
        phone: '+919999999999',
      }
    });
    console.log('✅ Created super admin user');
  } else {
    console.log('ℹ️  Super admin already exists');
  }

  // Create institutions
  for (const inst of INSTITUTIONS) {
    const existing = await prisma.institutions.findFirst({
      where: { instituteName: inst.instituteName }
    });

    if (!existing) {
      await prisma.institutions.create({
        data: {
          ...inst,
          adminUserId: superAdmin.id
        }
      });
      console.log(`✅ Created institution: ${inst.instituteName}`);
    } else {
      console.log(`ℹ️  Institution already exists: ${inst.instituteName}`);
    }
  }

  // Create sample companies
  const companies = [
    { companyName: 'Google India', website: 'google.com', industry: 'Technology', location: 'Bangalore', description: 'Leading tech company' },
    { companyName: 'Microsoft', website: 'microsoft.com', industry: 'Technology', location: 'Hyderabad', description: 'Software giant' },
    { companyName: 'Amazon', website: 'amazon.com', industry: 'E-commerce', location: 'Mumbai', description: 'E-commerce leader' },
    { companyName: 'Flipkart', website: 'flipkart.com', industry: 'E-commerce', location: 'Bangalore', description: 'Indian e-commerce' },
    { companyName: 'Infosys', website: 'infosys.com', industry: 'IT Services', location: 'Pune', description: 'IT consulting services' },
  ];

  const createdCompanies = [];
  for (const comp of companies) {
    const existingCompany = await prisma.companies.findFirst({
      where: { companyName: comp.companyName }
    });

    if (!existingCompany) {
      // Create company user
      const compSalt = randomBytes(16).toString('hex');
      const compHash = createHmac('sha256', compSalt).update('password123').digest('hex');
      
      const companyUser = await prisma.users.create({
        data: {
          displayName: comp.companyName,
          email: `${comp.companyName.toLowerCase().replace(/\s+/g, '')}@company.com`,
          role: 'industry',
          hashPassword: compHash,
          salt: compSalt,
          phone: '+919000000000',
        }
      });

      const company = await prisma.companies.create({
        data: {
          userId: companyUser.id,
          ...comp
        }
      });
      createdCompanies.push(company);
      console.log(`✅ Created company: ${comp.companyName}`);
    } else {
      createdCompanies.push(existingCompany);
      console.log(`ℹ️  Company already exists: ${comp.companyName}`);
    }
  }

  // Create sample internships
  const internships = [
    { title: 'Frontend Developer Intern', type: 'Engineering', stipend: 18000, location: 'Bangalore', duration_weeks: 12, description: 'Build responsive UIs with React', required_skills: ['React', 'JavaScript', 'CSS'] },
    { title: 'Backend Engineer Intern', type: 'Engineering', stipend: 20000, location: 'Hyderabad', duration_weeks: 16, description: 'Develop scalable APIs', required_skills: ['Node.js', 'Express', 'MongoDB'] },
    { title: 'Data Science Intern', type: 'Data Science', stipend: 25000, location: 'Mumbai', duration_weeks: 12, description: 'Analyze datasets and build ML models', required_skills: ['Python', 'Pandas', 'Machine Learning'] },
    { title: 'UI/UX Design Intern', type: 'Design', stipend: 15000, location: 'Bangalore', duration_weeks: 10, description: 'Create user-friendly designs', required_skills: ['Figma', 'UI/UX', 'Wireframing'] },
    { title: 'Digital Marketing Intern', type: 'Marketing', stipend: 12000, location: 'Pune', duration_weeks: 8, description: 'Manage social media campaigns', required_skills: ['SEO', 'Social Media', 'Content Writing'] },
  ];

  for (let i = 0; i < internships.length; i++) {
    const intern = internships[i];
    const company = createdCompanies[i % createdCompanies.length];
    
    const existingIntern = await prisma.internships.findFirst({
      where: { 
        title: intern.title,
        company_id: company.id 
      }
    });

    if (!existingIntern) {
      await prisma.internships.create({
        data: {
          ...intern,
          company_id: company.id,
          industry_user_id: company.userId,
          created_at: new Date(),
          required_skills: intern.required_skills
        }
      });
      console.log(`✅ Created internship: ${intern.title}`);
    } else {
      console.log(`ℹ️  Internship already exists: ${intern.title}`);
    }
  }

  // Create sample mentors
  const mentors = [
    { name: 'Aisha Khan', expertise: 'Product Management', experience: '8 years', bio: 'Senior PM at Google, helping early-career PMs' },
    { name: 'Rohit Sharma', expertise: 'Frontend Engineering', experience: '6 years', bio: 'Staff Engineer at Netflix, frontend expert' },
    { name: 'Dr. Priya Singh', expertise: 'Machine Learning', experience: '10 years', bio: 'AI Researcher at OpenAI, ML mentor' },
  ];

  for (const mentor of mentors) {
    const mentorEmail = `${mentor.name.toLowerCase().replace(/\s+/g, '.')}@mentor.com`;
    
    // Check if user exists first
    let mentorUser = await prisma.users.findUnique({
      where: { email: mentorEmail }
    });

    if (!mentorUser) {
      const mentorSalt = randomBytes(16).toString('hex');
      const mentorHash = createHmac('sha256', mentorSalt).update('password123').digest('hex');
      
      mentorUser = await prisma.users.create({
        data: {
          displayName: mentor.name,
          email: mentorEmail,
          role: 'mentor',
          hashPassword: mentorHash,
          salt: mentorSalt,
          phone: '+919100000000',
        }
      });
    }

    // Check if mentor profile exists
    const existingMentor = await prisma.mentors.findUnique({
      where: { user_id: mentorUser.id }
    });

    if (!existingMentor) {
      await prisma.mentors.create({
        data: {
          user_id: mentorUser.id,
          expertise: mentor.expertise,
          experience: mentor.experience,
          bio: mentor.bio,
          rating: 4.8
        }
      });
      console.log(`✅ Created mentor: ${mentor.name}`);
    } else {
      console.log(`ℹ️  Mentor already exists: ${mentor.name}`);
    }
  }

  // Create sample faculty
  const facultyData = [
    { name: 'Dr. Ramesh Kumar', department: 'Computer Science', institution: 'IIIT Nagpur' },
    { name: 'Prof. Anjali Sharma', department: 'Electronics', institution: 'IIT Bombay' },
  ];

  for (const fac of facultyData) {
    const facEmail = `${fac.name.toLowerCase().replace(/\s+/g, '.')}@faculty.com`;
    
    let facUser = await prisma.users.findUnique({
      where: { email: facEmail }
    });

    if (!facUser) {
      const facSalt = randomBytes(16).toString('hex');
      const facHash = createHmac('sha256', facSalt).update('password123').digest('hex');
      
      facUser = await prisma.users.create({
        data: {
          displayName: fac.name,
          email: facEmail,
          role: 'faculty',
          hashPassword: facHash,
          salt: facSalt,
          phone: '+919200000000',
        }
      });
    }

    const institute = await prisma.institutions.findFirst({
      where: { instituteName: fac.institution }
    });

    if (institute) {
      const existingFaculty = await prisma.faculty.findUnique({
        where: { userId: facUser.id }
      });

      if (!existingFaculty) {
        await prisma.faculty.create({
          data: {
            userId: facUser.id,
            instituteId: institute.id,
            name: fac.name,
            department: fac.department
          }
        });
        console.log(`✅ Created faculty: ${fac.name}`);
      } else {
        console.log(`ℹ️  Faculty already exists: ${fac.name}`);
      }
    }
  }

  // Create mentor sessions for Aisha Khan
  const aishaKhan = await prisma.mentors.findFirst({
    where: {
      user: {
        email: 'aisha.khan@mentor.com'
      }
    },
    include: { user: true }
  });

  if (aishaKhan) {
    // Get some students for mentor sessions
    const students = await prisma.profile.findMany({
      take: 5,
      include: { user: true }
    });

    if (students.length > 0) {
      const sessionData = [
        { studentId: students[0].id, scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000), status: 'scheduled', topic: 'Career Guidance' },
        { studentId: students[1].id, scheduledAt: new Date(Date.now() + 6 * 60 * 60 * 1000), status: 'scheduled', topic: 'Project Discussion' },
        { studentId: students[2].id, scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), status: 'scheduled', topic: 'Resume Review' },
        { studentId: students[0].id, scheduledAt: new Date(Date.now() - 48 * 60 * 60 * 1000), status: 'completed', topic: 'Mock Interview' },
        { studentId: students[3].id, scheduledAt: new Date(Date.now() - 96 * 60 * 60 * 1000), status: 'completed', topic: 'Career Planning' },
      ];

      for (const session of sessionData) {
        const existing = await prisma.mentorSessions.findFirst({
          where: {
            mentorId: aishaKhan.id,
            studentId: session.studentId,
            scheduled_at: session.scheduledAt
          }
        });

        if (!existing) {
          await prisma.mentorSessions.create({
            data: {
              mentorId: aishaKhan.id,
              studentId: session.studentId,
              scheduled_at: session.scheduledAt,
              status: session.status,
              topic: session.topic,
              meeting_link: 'https://meet.google.com/abc-defg-hij'
            }
          });
        }
      }

      console.log(`✅ Created mentor sessions for ${aishaKhan.user.displayName}`);

      // Create notifications for Aisha Khan
      const notificationData = [
        { title: 'New Booking Request', message: `${students[0].user.displayName} has requested a session on ${new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleString()} for Career Guidance`, read: false },
        { title: 'Upcoming Session Reminder', message: `You have a session with ${students[1].user.displayName} starting in 2 hours`, read: false },
        { title: 'New Message', message: `${students[2].user.displayName} sent you a message regarding project guidance`, read: false },
        { title: 'Booking Confirmed', message: `${students[3].user.displayName} confirmed the session scheduled for tomorrow at 10:00 AM`, read: true },
        { title: 'Session Completed', message: `Session with ${students[0].user.displayName} marked as completed`, read: true },
      ];

      for (const notif of notificationData) {
        const notification = await prisma.notifications.create({
          data: {
            title: notif.title,
            message: notif.message,
            created_at: new Date()
          }
        });

        await prisma.user_notifications.create({
          data: {
            user_id: aishaKhan.user_id,
            notification_id: notification.id,
            isRead: notif.read,
            read_at: notif.read ? new Date() : null
          }
        });
      }

      console.log(`✅ Created notifications for ${aishaKhan.user.displayName}`);
    }
  }

  console.log('\n🎉 Database seeding completed!');
  console.log('\n📝 Credentials:');
  console.log('   Super Admin - admin@edusphere.com : password123');
  console.log('   Companies - [companyname]@company.com : password123');
  console.log('   Mentors - aisha.khan@mentor.com : password123');
  console.log('   Faculty - [faculty.name]@faculty.com : password123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });