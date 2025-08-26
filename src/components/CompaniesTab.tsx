import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { StarRating } from '@/components/StarRating';
import { useAuth } from '@/contexts/AuthContext';
import { mockCompanies, mockReviews, Review } from '@/data/mockData';
import { Building2, MapPin, Code, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const CompaniesTab: React.FC = () => {
  const { user, isAuthenticated, generateAnonymousName } = useAuth();
  const { toast } = useToast();
  const [selectedCompany, setSelectedCompany] = useState(mockCompanies[0]);
  const [reviews, setReviews] = useState<Review[]>(mockReviews);
  const [newReview, setNewReview] = useState({ content: '', rating: 5, isAnonymous: true });

  const companyReviews = reviews.filter(
    review => review.entityType === 'company' && review.entityId === selectedCompany.id
  );

  const handleSubmitReview = () => {
    if (!isAuthenticated) {
      toast({ title: 'Please login', description: 'You need to be logged in to submit reviews.' });
      return;
    }

    if (!newReview.content.trim()) {
      toast({ title: 'Missing content', description: 'Please write a review before submitting.' });
      return;
    }

    const review: Review = {
      id: Math.random().toString(36).substr(2, 9),
      entityType: 'company',
      entityId: selectedCompany.id,
      content: newReview.content,
      rating: newReview.rating,
      author: newReview.isAnonymous 
        ? generateAnonymousName('company', selectedCompany.id) 
        : user!.username,
      isAnonymous: newReview.isAnonymous,
      timestamp: new Date()
    };

    setReviews([review, ...reviews]);
    setNewReview({ content: '', rating: 5, isAnonymous: true });
    toast({ title: 'Review submitted!', description: 'Thank you for sharing your experience.' });
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Company List */}
      <div className="lg:col-span-1 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Select a Company</h3>
        {mockCompanies.map((company) => (
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
                <StarRating rating={company.averageRating} readonly size="sm" />
                <span className="text-xs text-muted-foreground">
                  {company.totalReviews} reviews
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
                    <Badge variant="outline">{selectedCompany.industry}</Badge>
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
                {selectedCompany.techStack.map((tech, index) => (
                  <Badge key={index} variant="secondary">{tech}</Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-4">
                <StarRating rating={selectedCompany.averageRating} readonly />
                <span className="text-sm text-muted-foreground">
                  {selectedCompany.totalReviews} reviews
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
              placeholder="Share your experience with this company. How was the work culture, interview process, work-life balance, growth opportunities, etc.?"
              value={newReview.content}
              onChange={(e) => setNewReview({ ...newReview, content: e.target.value })}
              className="min-h-[100px]"
            />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="anonymous-company-review"
                  checked={newReview.isAnonymous}
                  onCheckedChange={(checked) => setNewReview({ ...newReview, isAnonymous: checked })}
                />
                <Label htmlFor="anonymous-company-review" className="text-sm">
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
                      {formatTimeAgo(review.timestamp)}
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