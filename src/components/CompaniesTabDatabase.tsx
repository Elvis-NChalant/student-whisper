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
import { Building2, MapPin, Briefcase, Code, MessageSquare } from 'lucide-react';
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

export const CompaniesTabDatabase: React.FC = () => {
  const { user, isAuthenticated, generateAnonymousName, profile } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [newReview, setNewReview] = useState({ content: '', rating: 5, isAnonymous: true });

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      fetchReviews(selectedCompany.id);
    }
  }, [selectedCompany]);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
      if (data && data.length > 0) {
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
    const companyReviews = reviews.filter(r => r.entity_id === companyId);
    if (companyReviews.length === 0) return 0;
    const sum = companyReviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / companyReviews.length;
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Company List */}
      <div className="lg:col-span-1 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Select a Company</h3>
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
                <Badge variant="secondary">{company.industry}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {company.location}
              </p>
              <div className="flex items-center justify-between">
                <StarRating rating={calculateAverageRating(company.id)} readonly size="sm" />
                <span className="text-xs text-muted-foreground">
                  {reviews.filter(r => r.entity_id === company.id).length} reviews
                </span>
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
                <span className="text-sm text-muted-foreground">
                  {companyReviews.length} reviews
                </span>
              </div>
            </div>
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
  );
};