import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AuthModal } from '@/components/AuthModal';
import { FeedTab } from '@/components/FeedTab';
import { CoursesTabDatabase } from '@/components/CoursesTabDatabase';
import { CompaniesTabDatabase } from '@/components/CompaniesTabDatabase';
import { BookingTab } from '@/components/BookingTab'; // Add this import
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { MessageSquare, BookOpen, Building2, LogOut, User, Calendar } from 'lucide-react'; // Add Calendar icon

const MainContent = () => {
  const { user, profile, isAuthenticated, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-gradient-card shadow-card sticky top-0 z-50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-hero rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
                StudentWhisper
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-accent text-accent-foreground text-sm">
                        {profile?.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{profile?.username || 'User'}</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={logout}
                    className="flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="hero" 
                  onClick={() => setAuthModalOpen(true)}
                  className="flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  Join Community
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Section */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">
              StudentWhisper Campus Platform
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Your comprehensive platform for course reviews, company insights, and campus bookings.
              Make informed decisions and manage your academic journey effectively.
            </p>
          </div>

          {/* Navigation Tabs */}
          <Tabs defaultValue="feed" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-8 bg-gradient-card shadow-card">
              <TabsTrigger value="feed" className="flex items-center gap-2 text-base">
                <MessageSquare className="w-5 h-5" />
                Community Feed
              </TabsTrigger>
              <TabsTrigger value="courses" className="flex items-center gap-2 text-base">
                <BookOpen className="w-5 h-5" />
                Courses
              </TabsTrigger>
              <TabsTrigger value="companies" className="flex items-center gap-2 text-base">
                <Building2 className="w-5 h-5" />
                Companies
              </TabsTrigger>
              <TabsTrigger value="booking" className="flex items-center gap-2 text-base">
                <Calendar className="w-5 h-5" />
                Campus Booking
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="feed">
              <FeedTab />
            </TabsContent>
            
            <TabsContent value="courses">
              <CoursesTabDatabase />
            </TabsContent>
            
            <TabsContent value="companies">
              <CompaniesTabDatabase />
            </TabsContent>
            
            <TabsContent value="booking">
              <BookingTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-gradient-card mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-muted-foreground">
              StudentWhisper - Your complete campus companion platform
            </p>
          </div>
        </div>
      </footer>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </div>
  );
};

const Index = () => {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
};

export default Index;
