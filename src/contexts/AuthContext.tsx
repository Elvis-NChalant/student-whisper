import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  generateAnonymousName: (entityType: string, entityId: string) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check for stored auth token on mount
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    // Mock login - in real app this would call your API
    try {
      const mockUser = {
        id: Math.random().toString(36).substr(2, 9),
        username,
        email: `${username}@example.com`
      };
      setUser(mockUser);
      localStorage.setItem('user', JSON.stringify(mockUser));
      return true;
    } catch (error) {
      return false;
    }
  };

  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    // Mock registration - in real app this would call your API
    try {
      const mockUser = {
        id: Math.random().toString(36).substr(2, 9),
        username,
        email
      };
      setUser(mockUser);
      localStorage.setItem('user', JSON.stringify(mockUser));
      return true;
    } catch (error) {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const generateAnonymousName = (entityType: string, entityId: string): string => {
    if (!user) return 'Anonymous User';
    
    // Simple hash function for consistent anonymous names
    const hash = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash);
    };

    const seed = hash(user.id + entityType + entityId);
    const names = [
      'Senior Student', 'Graduate Student', 'Anonymous Scholar', 'Study Buddy',
      'Course Veteran', 'Academic Explorer', 'Knowledge Seeker', 'Campus Insider'
    ];
    
    const nameIndex = seed % names.length;
    const number = (seed % 999) + 1;
    
    return `${names[nameIndex]} ${number}`;
  };

  const value = {
    user,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    generateAnonymousName
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};