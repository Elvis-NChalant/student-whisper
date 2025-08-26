-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create courses table
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  instructor TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 3,
  description TEXT NOT NULL,
  prerequisites TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  tech_stack TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create posts table for feed
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create likes table for posts
CREATE TABLE public.post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Create reviews table for courses and companies
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('course', 'company')),
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" 
ON public.profiles FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for courses (public read)
CREATE POLICY "Anyone can view courses" 
ON public.courses FOR SELECT 
USING (true);

-- RLS Policies for companies (public read)
CREATE POLICY "Anyone can view companies" 
ON public.companies FOR SELECT 
USING (true);

-- RLS Policies for posts
CREATE POLICY "Anyone can view posts" 
ON public.posts FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own posts" 
ON public.posts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" 
ON public.posts FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" 
ON public.posts FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for post likes
CREATE POLICY "Anyone can view post likes" 
ON public.post_likes FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own likes" 
ON public.post_likes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" 
ON public.post_likes FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for reviews
CREATE POLICY "Anyone can view reviews" 
ON public.reviews FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own reviews" 
ON public.reviews FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" 
ON public.reviews FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews" 
ON public.reviews FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert sample courses
INSERT INTO public.courses (name, code, instructor, credits, description, prerequisites) VALUES
('Data Structures and Algorithms', 'CS 301', 'Dr. Smith', 3, 'Comprehensive study of fundamental data structures and algorithms including arrays, linked lists, trees, graphs, sorting, and searching algorithms.', ARRAY['Introduction to Programming', 'Discrete Mathematics']),
('Machine Learning Fundamentals', 'CS 401', 'Prof. Johnson', 4, 'Introduction to machine learning concepts and applications including supervised learning, unsupervised learning, and neural networks.', ARRAY['Linear Algebra', 'Statistics', 'Python Programming']),
('Database Systems', 'CS 350', 'Dr. Williams', 3, 'Design and implementation of database systems, SQL, normalization, and transaction processing.', ARRAY['Data Structures', 'Software Engineering']),
('Computer Networks', 'CS 425', 'Prof. Brown', 3, 'Fundamentals of computer networking including protocols, routing, and network security.', ARRAY['Operating Systems', 'Computer Architecture']);

-- Insert sample companies
INSERT INTO public.companies (name, industry, location, description, tech_stack) VALUES
('TechCorp Solutions', 'Software Development', 'San Francisco, CA', 'Leading software development company specializing in enterprise solutions and cloud computing.', ARRAY['React', 'Node.js', 'Python', 'AWS', 'Docker']),
('DataFlow Analytics', 'Data Analytics', 'New York, NY', 'Data analytics company helping businesses make data-driven decisions with advanced analytics and AI.', ARRAY['Python', 'R', 'SQL', 'Tableau', 'Spark']),
('CloudNine Systems', 'Cloud Computing', 'Seattle, WA', 'Cloud infrastructure provider offering scalable solutions for modern applications.', ARRAY['AWS', 'Kubernetes', 'Go', 'Terraform', 'MongoDB']),
('InnovateLab', 'Artificial Intelligence', 'Boston, MA', 'AI research and development company focusing on machine learning and computer vision.', ARRAY['PyTorch', 'TensorFlow', 'Python', 'CUDA', 'OpenCV']);