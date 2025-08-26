import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { StarRating } from '@/components/StarRating';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, GraduationCap, Clock, MessageSquare, Wifi, WifiOff, Brain, Upload, Info, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Course {
  id: string;
  name: string;
  code: string;
  instructor: string;
  credits: number;
  description: string;
  prerequisites: string[];
  created_at: string;
}

interface Review {
  id: string;
  entity_type: string;
  entity_id: string;
  content: string;
  rating: number;
  user_id: string;
  author: string;
  is_anonymous: boolean;
  created_at: string;
}

interface ApiRatingResponse {
  rating: number;
  success: boolean;
  message?: string;
  compatibility_score?: number;
  match_details?: string;
}

interface ResumeUploadResponse {
  success: boolean;
  message: string;
  resume_summary?: string;
  key_skills?: string[];
  experience_years?: number;
}

export const CoursesTabDatabase: React.FC = () => {
  const { user, isAuthenticated, generateAnonymousName, profile } = useAuth();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [newReview, setNewReview] = useState({ content: '', rating: 5, isAnonymous: true });
  
  // Enhanced rating states
  const [apiRatings, setApiRatings] = useState<{[courseId: string]: number}>({});
  const [apiStatus, setApiStatus] = useState<{[courseId: string]: 'loading' | 'success' | 'failed'}>({});
  const [matchDetails, setMatchDetails] = useState<{[courseId: string]: string}>({});
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [resumeInfo, setResumeInfo] = useState<{summary?: string, skills?: string[], experience?: number} | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [showResumeUpload, setShowResumeUpload] = useState(false);

  useEffect(() => {
    fetchCourses();
    checkResumeStatus();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchReviews(selectedCourse.id);
    }
  }, [selectedCourse]);

  const checkResumeStatus = async () => {
    try {
      const response = await fetch('http://localhost:6969/health');
      const health = await response.json();
      setResumeUploaded(health.resume_loaded || false);
    } catch (error) {
      console.warn('Unable to check resume status:', error);
    }
  };

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF or DOCX file.',
        variant: 'destructive'
      });
      return;
    }

    setUploadingResume(true);

    try {
      const formData = new FormData();
      formData.append('resume', file);

      const response = await fetch('http://localhost:6969/upload_resume_for_rating', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ResumeUploadResponse = await response.json();

      if (data.success) {
        setResumeUploaded(true);
        setResumeInfo({
          summary: data.resume_summary,
          skills: data.key_skills,
          experience: data.experience_years
        });
        setShowResumeUpload(false);
        
        toast({
          title: 'Resume uploaded successfully!',
          description: 'You will now get personalized course recommendations based on your profile.'
        });

        // Refresh ratings with new resume
        await refreshAllRatings();
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Resume upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload resume. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setUploadingResume(false);
    }
  };

  const refreshAllRatings = async () => {
    if (courses.length === 0) return;

    const ratings: {[courseId: string]: number} = {};
    const details: {[courseId: string]: string} = {};
    
    const ratingPromises = courses.map(async (course) => {
      try {
        const { rating, matchDetail } = await fetchCourseRating(course);
        ratings[course.id] = rating;
        if (matchDetail) {
          details[course.id] = matchDetail;
        }
        return { courseId: course.id, rating, success: true };
      } catch (error) {
        console.error(`Failed to get rating for ${course.name}:`, error);
        ratings[course.id] = 3.5; // Default fallback
        return { courseId: course.id, rating: 3.5, success: false };
      }
    });
    
    await Promise.allSettled(ratingPromises);
    setApiRatings(ratings);
    setMatchDetails(details);
  };

  const fetchCourseRating = async (course: Course): Promise<{rating: number, matchDetail?: string}> => {
    try {
      setApiStatus(prev => ({ ...prev, [course.id]: 'loading' }));
      
      const response = await fetch('http://localhost:6969/getRating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: course.id,
          name: course.name,
          code: course.code,
          instructor: course.instructor,
          credits: course.credits,
          description: course.description,
          prerequisites: course.prerequisites
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP ${response.status}: ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiRatingResponse = await response.json();
      
      if (data.success && typeof data.rating === 'number') {
        setApiStatus(prev => ({ ...prev, [course.id]: 'success' }));
        const rating = Math.max(0, Math.min(5, data.rating));
        return { 
          rating, 
          matchDetail: data.match_details || undefined 
        };
      } else {
        console.warn(`Invalid rating response for ${course.name}:`, data);
        throw new Error(data.message || 'Invalid rating response');
      }
    } catch (error) {
      console.warn(`Rating API unavailable for course ${course.code}:`, error);
      setApiStatus(prev => ({ ...prev, [course.id]: 'failed' }));
      return { rating: 3.5 };
    }
  };

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('name');

      if (error) throw error;
      setCourses(data || []);
      
      // Fetch ratings for all courses
      if (data && data.length > 0) {
        const ratings: {[courseId: string]: number} = {};
        const details: {[courseId: string]: string} = {};
        
        const ratingPromises = data.map(async (course) => {
          try {
            const { rating, matchDetail } = await fetchCourseRating(course);
            ratings[course.id] = rating;
            if (matchDetail) {
              details[course.id] = matchDetail;
            }
            return { courseId: course.id, rating };
          } catch (error) {
            console.error(`Failed to get rating for ${course.name}:`, error);
            ratings[course.id] = 3.5;
            return { courseId: course.id, rating: 3.5 };
          }
        });
        
        await Promise.allSettled(ratingPromises);
        setApiRatings(ratings);
        setMatchDetails(details);
        setSelectedCourse(data[0]);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast({ title: 'Error', description: 'Failed to load courses.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async (courseId: string) => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('entity_type', 'course')
        .eq('entity_id', courseId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const reviewsWithAuthors = await Promise.all(
        (data || []).map(async (review) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username')
            .eq('user_id', review.user_id)
            .single();

          return {
            ...review,
            author: review.is_anonymous 
              ? generateAnonymousName('course', courseId)
              : profileData?.username || 'Unknown User'
          };
        })
      );

      setReviews(reviewsWithAuthors);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast({ title: 'Error', description: 'Failed to load reviews.' });
    }
  };

  const handleSubmitReview = async () => {
    if (!isAuthenticated || !user || !selectedCourse) {
      toast({ title: 'Please login', description: 'You need to be logged in to submit reviews.' });
      return;
    }

    if (!newReview.content.trim()) {
      toast({ title: 'Missing content', description: 'Please write a review before submitting.' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('reviews')
        .insert({
          entity_type: 'course',
          entity_id: selectedCourse.id,
          content: newReview.content,
          rating: newReview.rating,
          user_id: user.id,
          is_anonymous: newReview.isAnonymous
        })
        .select()
        .single();

      if (error) throw error;

      const newReviewWithAuthor = {
        ...data,
        author: newReview.isAnonymous 
          ? generateAnonymousName('course', selectedCourse.id)
          : profile?.username || 'Unknown User'
      };

      setReviews([newReviewWithAuthor, ...reviews]);
      setNewReview({ content: '', rating: 5, isAnonymous: true });
      toast({ title: 'Review submitted!', description: 'Thank you for sharing your experience.' });
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: 'Already reviewed', description: 'You have already reviewed this course.' });
      } else {
        console.error('Error submitting review:', error);
        toast({ title: 'Error', description: 'Failed to submit review.' });
      }
    }
  };

  const calculateAverageRating = (courseId: string) => {
    // Prioritize API rating if available
    if (apiRatings[courseId] && apiStatus[courseId] === 'success') {
      return apiRatings[courseId];
    }
    
    if (apiRatings[courseId]) {
      return apiRatings[courseId];
    }
    
    // Fallback to user review ratings
    const courseReviews = reviews.filter(r => r.entity_id === courseId);
    if (courseReviews.length === 0) return 3.5;
    const sum = courseReviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / courseReviews.length;
  };

  const getRatingSource = (courseId: string) => {
    if (apiStatus[courseId] === 'loading') return 'Analyzing compatibility...';
    if (apiStatus[courseId] === 'success') {
      return resumeUploaded ? 'AI-Powered Recommendation' : 'External Rating';
    }
    if (apiStatus[courseId] === 'failed') return 'Default Rating (API offline)';
    
    const courseReviews = reviews.filter(r => r.entity_id === courseId);
    return `${courseReviews.length} student reviews`;
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 3.5) return 'text-yellow-600';
    if (rating >= 2.5) return 'text-orange-600';
    return 'text-red-600';
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-card shadow-card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading courses...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedCourse) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-card shadow-card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No courses available.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const averageRating = calculateAverageRating(selectedCourse.id);
  const courseReviews = reviews.filter(r => r.entity_id === selectedCourse.id);

  return (
    <div className="space-y-6">
      {/* Resume Upload Section */}
      {!resumeUploaded && (
        <Card className="bg-gradient-card shadow-card border-accent/20">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Brain className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold">Get Personalized Course Recommendations</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload your resume to receive AI-powered compatibility scores for each course
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowResumeUpload(!showResumeUpload)}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload Resume
              </Button>
            </div>
            
            {showResumeUpload && (
              <div className="mt-4 pt-4 border-t">
                <Label htmlFor="resume-upload" className="cursor-pointer">
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent/50 transition-colors">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm">Click to upload your resume (PDF or DOCX)</p>
                  </div>
                </Label>
                <input
                  id="resume-upload"
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleResumeUpload}
                  disabled={uploadingResume}
                  className="hidden"
                />
                {uploadingResume && (
                  <div className="mt-2 text-center">
                    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin w-4 h-4 border border-accent border-t-transparent rounded-full" />
                      Processing resume...
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resume Info Display */}
      {resumeInfo && (
        <Card className="bg-gradient-card shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">Resume Analysis Complete</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {resumeInfo.experience && (
                <div>
                  <span className="font-medium">Experience:</span> {resumeInfo.experience} years
                </div>
              )}
              {resumeInfo.skills && resumeInfo.skills.length > 0 && (
                <div className="md:col-span-2">
                  <span className="font-medium">Key Skills:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {resumeInfo.skills.slice(0, 5).map((skill, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {resumeInfo.skills.length > 5 && (
                      <span className="text-xs text-muted-foreground">+{resumeInfo.skills.length - 5} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Course List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Select a Course</h3>
            {resumeUploaded && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Brain className="w-3 h-3" />
                AI-Powered
              </Badge>
            )}
          </div>
          {courses.map((course) => (
            <Card 
              key={course.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-card ${
                selectedCourse.id === course.id 
                  ? 'ring-2 ring-accent bg-gradient-card shadow-card' 
                  : 'bg-card hover:bg-gradient-card'
              }`}
              onClick={() => setSelectedCourse(course)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-sm">{course.name}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{course.code}</Badge>
                    {apiStatus[course.id] === 'loading' && (
                      <div className="animate-spin w-3 h-3 border border-accent border-t-transparent rounded-full" />
                    )}
                    {apiStatus[course.id] === 'success' && resumeUploaded && (
                      <Brain className="w-3 h-3 text-green-500" />
                    )}
                    {apiStatus[course.id] === 'success' && !resumeUploaded && (
                      <Wifi className="w-3 h-3 text-blue-500" />
                    )}
                    {apiStatus[course.id] === 'failed' && <WifiOff className="w-3 h-3 text-orange-500" />}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{course.instructor}</p>
                <div className="flex items-center justify-between">
                  <StarRating rating={calculateAverageRating(course.id)} readonly size="sm" />
                  <div className="text-right">
                    <div className={`text-xs font-medium ${getRatingColor(calculateAverageRating(course.id))}`}>
                      {calculateAverageRating(course.id).toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getRatingSource(course.id)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Course Details & Reviews */}
        <div className="lg:col-span-2 space-y-6">
          {/* Course Details */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <BookOpen className="w-6 h-6 text-accent" />
                    {selectedCourse.name}
                  </CardTitle>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-4 h-4" />
                      {selectedCourse.instructor}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {selectedCourse.credits} credits
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {selectedCourse.code}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground leading-relaxed">{selectedCourse.description}</p>
              
              <div>
                <h4 className="font-semibold mb-2">Prerequisites:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCourse.prerequisites.map((prereq, index) => (
                    <Badge key={index} variant="secondary">{prereq}</Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-4">
                  <StarRating rating={averageRating} readonly />
                  <div>
                    <div className={`text-sm font-medium ${getRatingColor(averageRating)}`}>
                      {averageRating.toFixed(1)} / 5.0
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getRatingSource(selectedCourse.id)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {apiStatus[selectedCourse.id] === 'success' && resumeUploaded && (
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-green-500" />
                      <Badge variant="outline" className="text-xs">
                        AI Match: {apiRatings[selectedCourse.id]?.toFixed(1)}
                      </Badge>
                    </div>
                  )}
                  {apiStatus[selectedCourse.id] === 'success' && !resumeUploaded && (
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-blue-500" />
                      <Badge variant="outline" className="text-xs">
                        External: {apiRatings[selectedCourse.id]?.toFixed(1)}
                      </Badge>
                    </div>
                  )}
                  {apiStatus[selectedCourse.id] === 'failed' && (
                    <div className="flex items-center gap-2">
                      <WifiOff className="w-4 h-4 text-orange-500" />
                      <Badge variant="outline" className="text-xs">
                        Offline: 3.5
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Match Details */}
              {matchDetails[selectedCourse.id] && resumeUploaded && (
                <div className="mt-4 p-3 bg-accent/5 rounded-lg border border-accent/20">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <h5 className="text-sm font-medium mb-1">AI Learning Compatibility Analysis</h5>
                      <p className="text-sm text-muted-foreground">
                        {matchDetails[selectedCourse.id]}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Review */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-accent" />
                Write a Review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Your Rating</Label>
                <StarRating 
                  rating={newReview.rating}
                  onRatingChange={(rating) => setNewReview({ ...newReview, rating })}
                />
              </div>
              
              <Textarea
                placeholder="Share your experience with this course. How was the content, teaching style, workload, etc.?"
                value={newReview.content}
                onChange={(e) => setNewReview({ ...newReview, content: e.target.value })}
                className="min-h-[100px]"
              />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="anonymous-review"
                    checked={newReview.isAnonymous}
                    onCheckedChange={(checked) => setNewReview({ ...newReview, isAnonymous: checked })}
                  />
                  <Label htmlFor="anonymous-review" className="text-sm">
                    Review anonymously {newReview.isAnonymous && isAuthenticated && 
                      `(as ${generateAnonymousName('course', selectedCourse.id)})`}
                  </Label>
                </div>
                <Button onClick={handleSubmitReview} variant="accent">
                  Submit Review
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Reviews List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Student Reviews</h3>
            {courseReviews.length === 0 ? (
              <Card className="bg-gradient-card shadow-card">
                <CardContent className="py-12 text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No reviews yet</h3>
                  <p className="text-muted-foreground">Be the first to review this course!</p>
                </CardContent>
              </Card>
            ) : (
              courseReviews.map((review) => (
                <Card key={review.id} className="bg-gradient-card shadow-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <StarRating rating={review.rating} readonly size="sm" />
                        <span className="text-sm text-muted-foreground">
                          by {review.author}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(review.created_at)}
                      </span>
                    </div>
                    <p className="text-foreground leading-relaxed">{review.content}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
