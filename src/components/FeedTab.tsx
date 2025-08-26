import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Heart, MessageCircle, Send, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  isAnonymous: boolean;
  likes: number;
  timestamp: Date;
  hasLiked: boolean;
}

export const FeedTab: React.FC = () => {
  const { user, isAuthenticated, generateAnonymousName } = useAuth();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([
    {
      id: '1',
      title: 'First week of CS 301 was intense!',
      content: 'Just finished the first week of Data Structures and Algorithms. The recursion problems are already challenging but Dr. Smith explains concepts really well. Anyone else finding the homework difficult?',
      author: 'Senior Student 42',
      isAnonymous: true,
      likes: 12,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      hasLiked: false
    },
    {
      id: '2',
      title: 'TechCorp Solutions Interview Experience',
      content: 'Just had my final round interview with TechCorp! The technical questions were fair and the team seemed really collaborative. They asked about React state management and system design. Fingers crossed! 🤞',
      author: 'Anonymous Graduate 123',
      isAnonymous: true,
      likes: 8,
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      hasLiked: true
    }
  ]);

  const [newPost, setNewPost] = useState({ title: '', content: '', isAnonymous: true });

  const handleCreatePost = () => {
    if (!isAuthenticated) {
      toast({ title: 'Please login', description: 'You need to be logged in to create posts.' });
      return;
    }

    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast({ title: 'Missing content', description: 'Please fill in both title and content.' });
      return;
    }

    const post: Post = {
      id: Math.random().toString(36).substr(2, 9),
      title: newPost.title,
      content: newPost.content,
      author: newPost.isAnonymous ? generateAnonymousName('feed', 'general') : user!.username,
      isAnonymous: newPost.isAnonymous,
      likes: 0,
      timestamp: new Date(),
      hasLiked: false
    };

    setPosts([post, ...posts]);
    setNewPost({ title: '', content: '', isAnonymous: true });
    toast({ title: 'Post created!', description: 'Your post has been shared with the community.' });
  };

  const handleLike = (postId: string) => {
    if (!isAuthenticated) {
      toast({ title: 'Please login', description: 'You need to be logged in to like posts.' });
      return;
    }

    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          likes: post.hasLiked ? post.likes - 1 : post.likes + 1,
          hasLiked: !post.hasLiked
        };
      }
      return post;
    }));
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  return (
    <div className="space-y-6">
      {/* Create Post Section */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-accent" />
            Share with the Community
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Post title..."
            value={newPost.title}
            onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
          />
          <Textarea
            placeholder="What's on your mind? Share your thoughts, experiences, or questions..."
            value={newPost.content}
            onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
            className="min-h-[100px]"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="anonymous"
                checked={newPost.isAnonymous}
                onCheckedChange={(checked) => setNewPost({ ...newPost, isAnonymous: checked })}
              />
              <Label htmlFor="anonymous" className="text-sm">
                Post anonymously {newPost.isAnonymous && isAuthenticated && 
                  `(as ${generateAnonymousName('feed', 'general')})`}
              </Label>
            </div>
            <Button onClick={handleCreatePost} variant="accent">
              Post
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id} className="bg-gradient-card shadow-card hover:shadow-elegant transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{post.title}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Users className="w-4 h-4" />
                    <span>{post.author}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(post.timestamp)}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-foreground leading-relaxed mb-4">{post.content}</p>
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center gap-2 ${post.hasLiked ? 'text-accent' : ''}`}
                >
                  <Heart className={`w-4 h-4 ${post.hasLiked ? 'fill-current' : ''}`} />
                  {post.likes}
                </Button>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Comment
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {posts.length === 0 && (
        <Card className="bg-gradient-card shadow-card">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
            <p className="text-muted-foreground">Be the first to share something with the community!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};