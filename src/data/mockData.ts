export interface Course {
  id: string;
  name: string;
  code: string;
  instructor: string;
  credits: number;
  description: string;
  prerequisites: string[];
  averageRating: number;
  totalReviews: number;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  location: string;
  description: string;
  techStack: string[];
  averageRating: number;
  totalReviews: number;
}

export interface Review {
  id: string;
  entityType: 'course' | 'company';
  entityId: string;
  content: string;
  rating: number;
  author: string;
  isAnonymous: boolean;
  timestamp: Date;
}

export const mockCourses: Course[] = [
  {
    id: '1',
    name: 'Data Structures and Algorithms',
    code: 'CS 301',
    instructor: 'Dr. Smith',
    credits: 3,
    description: 'Comprehensive study of fundamental data structures including arrays, linked lists, stacks, queues, trees, and graphs. Analysis of algorithms and their time/space complexity.',
    prerequisites: ['Introduction to Programming', 'Discrete Mathematics'],
    averageRating: 4.2,
    totalReviews: 28
  },
  {
    id: '2',
    name: 'Machine Learning Fundamentals',
    code: 'CS 401',
    instructor: 'Prof. Johnson',
    credits: 4,
    description: 'Introduction to machine learning concepts including supervised and unsupervised learning, neural networks, and deep learning applications.',
    prerequisites: ['Linear Algebra', 'Statistics', 'Python Programming'],
    averageRating: 4.5,
    totalReviews: 15
  },
  {
    id: '3',
    name: 'Database Systems',
    code: 'CS 320',
    instructor: 'Dr. Wilson',
    credits: 3,
    description: 'Design and implementation of database systems, SQL, normalization, transactions, and distributed databases.',
    prerequisites: ['Data Structures and Algorithms'],
    averageRating: 3.8,
    totalReviews: 22
  },
  {
    id: '4',
    name: 'Software Engineering',
    code: 'CS 350',
    instructor: 'Prof. Davis',
    credits: 4,
    description: 'Software development lifecycle, design patterns, testing methodologies, and project management in software development.',
    prerequisites: ['Object-Oriented Programming', 'Data Structures and Algorithms'],
    averageRating: 4.0,
    totalReviews: 31
  }
];

export const mockCompanies: Company[] = [
  {
    id: '1',
    name: 'TechCorp Solutions',
    industry: 'Software Development',
    location: 'San Francisco, CA',
    description: 'Leading software development company specializing in enterprise solutions and cloud computing platforms.',
    techStack: ['React', 'Node.js', 'Python', 'AWS', 'Docker', 'Kubernetes'],
    averageRating: 4.1,
    totalReviews: 18
  },
  {
    id: '2',
    name: 'DataFlow Analytics',
    industry: 'Data Analytics',
    location: 'New York, NY',
    description: 'Data analytics company helping businesses make data-driven decisions through advanced analytics and machine learning.',
    techStack: ['Python', 'R', 'SQL', 'Tableau', 'Spark', 'TensorFlow'],
    averageRating: 4.3,
    totalReviews: 12
  },
  {
    id: '3',
    name: 'CloudTech Innovations',
    industry: 'Cloud Computing',
    location: 'Austin, TX',
    description: 'Cloud infrastructure and DevOps solutions provider helping companies scale their operations efficiently.',
    techStack: ['AWS', 'Azure', 'Terraform', 'Jenkins', 'Docker', 'Python'],
    averageRating: 3.9,
    totalReviews: 25
  },
  {
    id: '4',
    name: 'Mobile First Labs',
    industry: 'Mobile Development',
    location: 'Seattle, WA',
    description: 'Mobile app development studio creating innovative iOS and Android applications for startups and enterprises.',
    techStack: ['React Native', 'Swift', 'Kotlin', 'Firebase', 'Redux', 'GraphQL'],
    averageRating: 4.4,
    totalReviews: 9
  }
];

export const mockReviews: Review[] = [
  {
    id: '1',
    entityType: 'course',
    entityId: '1',
    content: 'Great course! Dr. Smith explains complex algorithms in a very understandable way. The assignments are challenging but fair. Definitely improved my problem-solving skills.',
    rating: 5,
    author: 'Senior Student 42',
    isAnonymous: true,
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  },
  {
    id: '2',
    entityType: 'course',
    entityId: '1',
    content: 'Solid foundation course. The workload is heavy but manageable. Make sure you understand recursion before taking this class.',
    rating: 4,
    author: 'Study Buddy 15',
    isAnonymous: true,
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  },
  {
    id: '3',
    entityType: 'company',
    entityId: '1',
    content: 'Amazing work culture and great learning opportunities. The team is very collaborative and the tech stack is modern. Work-life balance could be better during crunch times.',
    rating: 4,
    author: 'Anonymous Graduate 89',
    isAnonymous: true,
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  },
  {
    id: '4',
    entityType: 'company',
    entityId: '2',
    content: 'Excellent for data science career growth. Lots of interesting projects and exposure to cutting-edge ML techniques. Management is supportive of professional development.',
    rating: 5,
    author: 'Data Explorer 156',
    isAnonymous: true,
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  }
];