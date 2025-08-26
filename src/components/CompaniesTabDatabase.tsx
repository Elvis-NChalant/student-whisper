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
import { Building2, MapPin, Briefcase, Code, MessageSquare, Wifi, WifiOff, Brain, Upload, Info, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Company {
  id: string;
  name: string;
  industry: string;
  location: string;
  description: string;
  tech_stack: string[];
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

export const CompaniesTabDatabase: React.FC = () => {
  const { user, isAuthenticated, generateAnonymousName, profile } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [newReview, setNewReview] = useState({ content: '', rating: 5, isAnonymous: true });
  
  // Enhanced rating states
  const [apiRatings, setApiRatings] = useState<{[companyId: string]: number}>({});
  const [apiStatus, setApiStatus] = useState<{[companyId: string]: 'loading' | 'success' | 'failed'}>({});
  const [matchDetails, setMatchDetails] = useState<{[companyId: string]: string}>({});
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [resumeInfo, setResumeInfo] = useState<{summary?: string, skills?: string[], experience?: number} | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [showResumeUpload, setShowResumeUpload] = useState(false);

  useEffect(() => {
    fetchCompanies();
    checkResumeStatus();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      fetchReviews(selectedCompany.id);
    }
  }, [selectedCompany]);

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
          description: 'You will now get personalized company ratings based on your profile.'
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
  if (companies.length === 0) return;

  const ratings: {[companyId: string]: number} = {};
  const details: {[companyId: string]: string} = {};
  
  // Use Promise.allSettled to handle individual failures gracefully
  const ratingPromises = companies.map(async (company) => {
    try {
      const { rating, matchDetail } = await fetchCompanyRating(company);
      ratings[company.id] = rating;
      if (matchDetail) {
        details[company.id] = matchDetail;
      }
      return { companyId: company.id, rating, success: true };
    } catch (error) {
      console.error(`Failed to get rating for ${company.name}:`, error);
      ratings[company.id] = 3.5; // Default fallback
      return { companyId: company.id, rating: 3.5, success: false };
    }
  });
  
  await Promise.allSettled(ratingPromises);
  setApiRatings(ratings);
  setMatchDetails(details);
};
  const fetchCompanyRating = async (company: Company): Promise<{rating: number, matchDetail?: string}> => {
  try {
    setApiStatus(prev => ({ ...prev, [company.id]: 'loading' }));
    
    const response = await fetch('http://localhost:6969/getRating', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: company.id,
        name: company.name,
        industry: company.industry,
        location: company.location,
        description: company.description,
        tech_stack: company.tech_stack
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP ${response.status}: ${errorText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ApiRatingResponse = await response.json();
    
    if (data.success && typeof data.rating === 'number') {
      setApiStatus(prev => ({ ...prev, [company.id]: 'success' }));
      const rating = Math.max(0, Math.min(5, data.rating));
      return { 
        rating, 
        matchDetail: data.match_details || undefined 
      };
    } else {
      console.warn(`Invalid rating response for ${company.name}:`, data);
      throw new Error(data.message || 'Invalid rating response');
    }
  } catch (error) {
    console.warn(`Rating API unavailable for company ${company.name}:`, error);
    setApiStatus(prev => ({ ...prev, [company.id]: 'failed' }));
    return { rating: 3.5 };
  }
};

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
      
      // Fetch ratings for all companies
      if (data && data.length > 0) {
        const ratings: {[companyId: string]: number} = {};
        const details: {[companyId: string]: string} = {};
        
        const ratingPromises = data.map(async (company) => {
          const { rating, matchDetail } = await fetchCompanyRating(company);
          ratings[company.id] = rating;
          if (matchDetail) {
            details[company.id] = matchDetail;
          }
          return { companyId: company.id, rating };
        });
        
        await Promise.allSettled(ratingPromises);
        setApiRatings(ratings);
        setMatchDetails(details);
        setSelectedCompany(data[0]);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({ title: 'Error', description: 'Failed to load companies.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('entity_type', 'company')
        .eq('entity_id', companyId)
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
              ? generateAnonymousName('company', companyId)
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
    if (!isAuthenticated || !user || !selectedCompany) {
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
          entity_type: 'company',
          entity_id: selectedCompany.id,
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
          ? generateAnonymousName('company', selectedCompany.id)
          : profile?.username || 'Unknown User'
      };

      setReviews([newReviewWithAuthor, ...reviews]);
      setNewReview({ content: '', rating: 5, isAnonymous: true });
      toast({ title: 'Review submitted!', description: 'Thank you for sharing your experience.' });
    } catch (error: any) {
      if (error.code === '23505') {
        toast({ title: 'Already reviewed', description: 'You have already reviewed this company.' });
      } else {
        console.error('Error submitting review:', error);
        toast({ title: 'Error', description: 'Failed to submit review.' });
      }
    }
  };

  const calculateAverageRating = (companyId: string) => {
    // Prioritize API rating if available
    if (apiRatings[companyId] && apiStatus[companyId] === 'success') {
      return apiRatings[companyId];
    }
    
    if (apiRatings[companyId]) {
      return apiRatings[companyId];
    }
    
    // Fallback to user review ratings
    const companyReviews = reviews.filter(r => r.entity_id === companyId);
    if (companyReviews.length === 0) return 3.5;
    const sum = companyReviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / companyReviews.length;
  };

  const getRatingSource = (companyId: string) => {
    if (apiStatus[companyId] === 'loading') return 'Analyzing compatibility...';
    if (apiStatus[companyId] === 'success') {
      return resumeUploaded ? 'AI-Powered Match Score' : 'External Rating';
    }
    if (apiStatus[companyId] === 'failed') return 'Default Rating (API offline)';
    
    const companyReviews = reviews.filter(r => r.entity_id === companyId);
    return `${companyReviews.length} employee reviews`;
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
            <p className="text-muted-foreground">Loading companies...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-card shadow-card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No companies available.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const averageRating = calculateAverageRating(selectedCompany.id);
  const companyReviews = reviews.filter(r => r.entity_id === selectedCompany.id);

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
                  <h3 className="font-semibold">Get Personalized Company Ratings</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload your resume to receive AI-powered compatibility scores for each company
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
        {/* Company List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Select a Company</h3>
            {resumeUploaded && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Brain className="w-3 h-3" />
                AI-Powered
              </Badge>
            )}
          </div>
          {companies.map((company) => (
            <Card 
              key={company.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-card ${
                selectedCompany.id === company.id 
                  ? 'ring-2 ring-accent bg-gradient-card shadow-card' 
                  : 'bg-card hover:bg-gradient-card'
              }`}
              onClick={() => setSelectedCompany(company)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-sm">{company.name}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{company.industry}</Badge>
                    {apiStatus[company.id] === 'loading' && (
                      <div className="animate-spin w-3 h-3 border border-accent border-t-transparent rounded-full" />
                    )}
                    {apiStatus[company.id] === 'success' && resumeUploaded && (
                      <Brain className="w-3 h-3 text-green-500" />
                    )}
                    {apiStatus[company.id] === 'success' && !resumeUploaded && (
                      <Wifi className="w-3 h-3 text-blue-500" />
                    )}
                    {apiStatus[company.id] === 'failed' && <WifiOff className="w-3 h-3 text-orange-500" />}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {company.location}
                </p>
                <div className="flex items-center justify-between">
                  <StarRating rating={calculateAverageRating(company.id)} readonly size="sm" />
                  <div className="text-right">
                    <div className={`text-xs font-medium ${getRatingColor(calculateAverageRating(company.id))}`}>
                      {calculateAverageRating(company.id).toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getRatingSource(company.id)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Company Details & Reviews */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Details */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Building2 className="w-6 h-6 text-accent" />
                    {selectedCompany.name}
                  </CardTitle>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-4 h-4" />
                      {selectedCompany.industry}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {selectedCompany.location}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground leading-relaxed">{selectedCompany.description}</p>
              
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  Tech Stack:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCompany.tech_stack.map((tech, index) => (
                    <Badge key={index} variant="outline">{tech}</Badge>
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
                      {getRatingSource(selectedCompany.id)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {apiStatus[selectedCompany.id] === 'success' && resumeUploaded && (
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-green-500" />
                      <Badge variant="outline" className="text-xs">
                        AI Match: {apiRatings[selectedCompany.id]?.toFixed(1)}
                      </Badge>
                    </div>
                  )}
                  {apiStatus[selectedCompany.id] === 'success' && !resumeUploaded && (
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-blue-500" />
                      <Badge variant="outline" className="text-xs">
                        External: {apiRatings[selectedCompany.id]?.toFixed(1)}
                      </Badge>
                    </div>
                  )}
                  {apiStatus[selectedCompany.id] === 'failed' && (
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
              {matchDetails[selectedCompany.id] && resumeUploaded && (
                <div className="mt-4 p-3 bg-accent/5 rounded-lg border border-accent/20">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <h5 className="text-sm font-medium mb-1">AI Compatibility Analysis</h5>
                      <p className="text-sm text-muted-foreground">
                        {matchDetails[selectedCompany.id]}
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
                placeholder="Share your experience working at this company. How was the culture, work-life balance, career growth, etc.?"
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
                      `(as ${generateAnonymousName('company', selectedCompany.id)})`}
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
            <h3 className="text-lg font-semibold">Employee Reviews</h3>
            {companyReviews.length === 0 ? (
              <Card className="bg-gradient-card shadow-card">
                <CardContent className="py-12 text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No reviews yet</h3>
                  <p className="text-muted-foreground">Be the first to review this company!</p>
                </CardContent>
              </Card>
            ) : (
              companyReviews.map((review) => (
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
