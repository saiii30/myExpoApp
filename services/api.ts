import axios from 'axios';

// Using ngrok tunnel for development - works from anywhere
// const API_BASE_URL = 'https://unwearying-vaingloriously-cecelia.ngrok-free.dev/api';
const API_BASE_URL = 'http://192.168.31.47:8000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const session: {
  token: string | null;
  user: {
    id: string;
    name: string;
    email: string | null;
    contact_number: string;
    agency_id: string;
    role: string;
    company_id?: string;
  } | null;
} = {
  token: null,
  user: null,
};

// Dummy loadSession to avoid breaking pages
export const loadSession = async () => {
  // Session details are managed in memory during runtime
};

// Fallback for AsyncStorage if it crashes
export const activeSession: { location_id: number | null } = {
  location_id: null
};

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    session.token = token;
  } else {
    delete api.defaults.headers.common['Authorization'];
    session.token = null;
  }
};

export const authAPI = {
  login: async (data: any) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },
  getAgencies: async () => {
    const response = await api.get('/auth/agencies');
    return response.data;
  },
};

export const tripsAPI = {
  getTrips: async (status?: string, driverId?: string, agencyId?: string) => {
    if (agencyId && driverId) {
      const response = await api.get(`/trips/agency/${agencyId}/driver/${driverId}`);
      return response.data;
    }
    const params: any = {};
    if (status) params.status = status;
    if (driverId) params.driver_id = driverId;
    const response = await api.get('/trips', { params });
    return response.data;
  },
  getTripHistory: async (agencyId: string, driverId: string) => {
    const response = await api.get(`/trips/history/agency/${agencyId}/driver/${driverId}`);
    return response.data;
  },
  createTrip: async (data: any) => {
    const response = await api.post('/trips', data);
    return response.data;
  },
  acceptTrip: async (tripId: string | number, driverId: string | number) => {
    const response = await api.put(`/trips/${tripId}/driver-response`, {
      driver_response: 'accepted'
    });
    return response.data;
  },
  rejectTrip: async (tripId: string | number, driverId: string | number, reason?: string) => {
    const response = await api.put(`/trips/${tripId}/driver-response`, {
      driver_response: 'declined',
      driver_reason: reason || 'Rejected by driver'
    });
    return response.data;
  },
  acceptReturnTrip: async (tripId: string | number, driverId: string | number) => {
    const response = await api.put(`/trips/${tripId}/driver-response-return`, {
      driver_response_two_way: 'accepted'
    });
    return response.data;
  },
  rejectReturnTrip: async (tripId: string | number, driverId: string | number, reason?: string) => {
    const response = await api.put(`/trips/${tripId}/driver-response-return`, {
      driver_response_two_way: 'declined',
      driver_reason_two_way: reason || 'Rejected by driver'
    });
    return response.data;
  },
  completeTrip: async (driverId: string | number, locationId: number) => {
    // The new API expects location_id as Form data
    const formData = new FormData();
    formData.append('location_id', locationId.toString());

    const response = await api.put(`mobile/location/deactivate/${driverId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  startLocationTracking: async (data: {
    driver_id: string | number;
    trip_id: string | number;
    agency_id: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    company_id?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    const formData = new FormData();
    formData.append('driver_id', data.driver_id.toString());
    formData.append('trip_id', data.trip_id.toString());
    formData.append('agency_id', data.agency_id);
    formData.append('latitude', data.latitude.toString());
    formData.append('longitude', data.longitude.toString());
    if (data.accuracy !== undefined) formData.append('accuracy', data.accuracy.toString());
    if (data.speed !== undefined) formData.append('speed', data.speed.toString());
    if (data.company_id !== undefined) formData.append('company_id', data.company_id);
    if (data.start_date !== undefined) formData.append('start_date', data.start_date);
    if (data.end_date !== undefined) formData.append('end_date', data.end_date);

    const response = await api.post('/mobile/location', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
