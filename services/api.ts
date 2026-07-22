import axios from 'axios';

// Using ngrok tunnel for development - works from anywhere
const API_BASE_URL = 'https://unwearying-vaingloriously-cecelia.ngrok-free.dev/api';

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
  rejectTrip: async (tripId: string | number, driverId: string | number) => {
    const response = await api.put(`/trips/${tripId}/driver-response`, {
      driver_response: 'declined',
      driver_reason: 'Rejected by driver'
    });
    return response.data;
  },
  completeTrip: async (tripId: string | number) => {
    const response = await api.put(`/trips/driver/${tripId}`, {
      is_active: false
    });
    return response.data;
  },
};
