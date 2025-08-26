import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, MapPin, User, Building, Trash2 } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

interface Venue {
  id: number;
  name: string;
  type: string;
  capacity: number;
  location: string;
}

interface Booking {
  id: number;
  venue_id: number;
  venue_name: string;
  booker_name: string;
  start_time: string;
  end_time: string;
}

const API_BASE_URL = 'http://localhost:8000';

export const BookingTab: React.FC = () => {
  const { toast } = useToast();
  const calendarRef = useRef<FullCalendar>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('UTC');
  const [bookingForm, setBookingForm] = useState({
    venue_id: '',
    booker_name: '',
    start_time: '',
    end_time: ''
  });

  const timezones = [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'America/New York' },
    { value: 'Europe/London', label: 'Europe/London' },
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney' }
  ];

  useEffect(() => {
    fetchVenues();
    fetchBookings();
    
    // Set user's timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(userTimezone);
  }, []);

  const fetchVenues = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/venues`);
      if (!response.ok) throw new Error('Failed to fetch venues');
      const data = await response.json();
      setVenues(data);
    } catch (error) {
      console.error('Error fetching venues:', error);
      toast({
        title: 'Error',
        description: 'Failed to load venues. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/bookings`);
      if (!response.ok) throw new Error('Failed to fetch bookings');
      const data = await response.json();
      setBookings(data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load bookings. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bookingForm.venue_id || !bookingForm.booker_name || !bookingForm.start_time || !bookingForm.end_time) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all booking details.',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          venue_id: parseInt(bookingForm.venue_id),
          booker_name: bookingForm.booker_name,
          start_time: new Date(bookingForm.start_time).toISOString(),
          end_time: new Date(bookingForm.end_time).toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Booking failed');
      }

      const newBooking = await response.json();
      setBookings([...bookings, newBooking]);
      setBookingForm({ venue_id: '', booker_name: '', start_time: '', end_time: '' });
      
      toast({
        title: 'Booking Successful!',
        description: `${newBooking.venue_name} has been booked successfully.`
      });
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: 'Booking Failed',
        description: error instanceof Error ? error.message : 'Failed to create booking. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBooking = async (bookingId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete booking');
      }

      setBookings(bookings.filter(b => b.id !== bookingId));
      toast({
        title: 'Booking Cancelled',
        description: 'Booking has been successfully cancelled.'
      });
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel booking. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleVenueSelectForCalendar = (venueId: string) => {
    setSelectedVenue(venueId);
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.removeAllEvents();
      
      if (venueId) {
        const filteredBookings = bookings.filter(booking => 
          booking.venue_id.toString() === venueId
        );
        
        const events = filteredBookings.map(booking => ({
          id: booking.id.toString(),
          title: `${booking.venue_name} - ${booking.booker_name}`,
          start: booking.start_time,
          end: booking.end_time,
          backgroundColor: '#3b82f6',
          borderColor: '#2563eb'
        }));
        
        calendarApi.addEventSource(events);
      }
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-card shadow-card">
          <CardContent className="py-12 text-center">
            <div className="animate-spin w-8 h-8 border border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading booking system...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Calendar className="w-6 h-6 text-accent" />
            Campus Booking Management System
          </CardTitle>
          <p className="text-muted-foreground">
            Book campus venues for meetings, studies, and events
          </p>
        </CardHeader>
      </Card>

      {/* Time Zone Selector */}
      <Card className="bg-gradient-card shadow-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="timezone" className="text-sm font-medium">
              Select Time Zone:
            </Label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="p-2 border border-border rounded-md focus:ring-2 focus:ring-accent bg-background text-foreground"
            >
              {timezones.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Calendar View */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent" />
            Booking Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="calendar_venue" className="text-sm font-medium mb-2 block">
              Select a venue to view bookings:
            </Label>
            <select
              id="calendar_venue"
              value={selectedVenue}
              onChange={(e) => handleVenueSelectForCalendar(e.target.value)}
              className="w-full p-2 border border-border rounded-md focus:ring-2 focus:ring-accent bg-background"
            >
              <option value="">Select a venue to view bookings</option>
              {venues.map(venue => (
                <option key={venue.id} value={venue.id.toString()}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="calendar-container">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
              }}
              slotMinTime="08:00:00"
              slotMaxTime="22:00:00"
              height="auto"
              timeZone={timezone}
              events={[]}
              editable={false}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={true}
              weekends={true}
              eventContent={(eventInfo) => (
                <div className="p-1">
                  <div className="font-semibold text-xs truncate">
                    {eventInfo.event.title}
                  </div>
                </div>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Make Booking */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-accent" />
              Make a Booking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div>
                <Label htmlFor="venue_select" className="text-sm font-medium">Select Venue</Label>
                <select
                  id="venue_select"
                  value={bookingForm.venue_id}
                  onChange={(e) => setBookingForm({...bookingForm, venue_id: e.target.value})}
                  className="mt-1 block w-full p-2 border border-border rounded-md focus:ring-2 focus:ring-accent bg-background"
                  required
                >
                  <option value="">Select a venue</option>
                  {venues.map(venue => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} (Capacity: {venue.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="booker_name" className="text-sm font-medium">Your Name</Label>
                <input
                  type="text"
                  id="booker_name"
                  value={bookingForm.booker_name}
                  onChange={(e) => setBookingForm({...bookingForm, booker_name: e.target.value})}
                  className="mt-1 block w-full p-2 border border-border rounded-md focus:ring-2 focus:ring-accent bg-background"
                  placeholder="Enter your name"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time" className="text-sm font-medium">Start Time</Label>
                  <input
                    type="datetime-local"
                    id="start_time"
                    value={bookingForm.start_time}
                    onChange={(e) => setBookingForm({...bookingForm, start_time: e.target.value})}
                    className="mt-1 block w-full p-2 border border-border rounded-md focus:ring-2 focus:ring-accent bg-background"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="end_time" className="text-sm font-medium">End Time</Label>
                  <input
                    type="datetime-local"
                    id="end_time"
                    value={bookingForm.end_time}
                    onChange={(e) => setBookingForm({...bookingForm, end_time: e.target.value})}
                    className="mt-1 block w-full p-2 border border-border rounded-md focus:ring-2 focus:ring-accent bg-background"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full flex items-center gap-2"
                disabled={submitting}
              >
                <Calendar className="w-4 h-4" />
                {submitting ? 'Booking...' : 'Book Now'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Venue List */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-accent" />
              Available Venues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {venues.map(venue => (
              <Card key={venue.id} className="p-3 bg-card border">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{venue.name}</h4>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Building className="w-3 h-3" />
                      {venue.type}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      {venue.location}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <User className="w-3 h-3" />
                      Capacity: {venue.capacity}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVenueSelectForCalendar(venue.id.toString())}
                  >
                    View Calendar
                  </Button>
                </div>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Current Bookings */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" />
            Current Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No bookings yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map(booking => (
                <Card key={booking.id} className="p-3 bg-card border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{booking.venue_name}</h4>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {booking.booker_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatDateTime(booking.start_time)}</p>
                        <p className="text-sm text-muted-foreground">to {formatDateTime(booking.end_time)}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteBooking(booking.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
