from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# Database configuration - using SQLite for local storage, PostgreSQL for trip schedules
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///travel_management.db')
app.config['SQLALCHEMY_BINDS'] = {
    'postgres_db': os.environ.get('POSTGRES_DATABASE_URL', 'postgresql://postgres:srisainila@localhost:5432/postgres')
}
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class TripSchedule(db.Model):
    __bind_key__ = 'postgres_db'
    __tablename__ = "trip_schedules"
    id = db.Column(db.String, primary_key=True, index=True)
    agency_id = db.Column(db.String, nullable=True, index=True)
    user_id = db.Column(db.String, nullable=False)
    company_id = db.Column(db.String, nullable=False)
    vehicle_id = db.Column(db.String, nullable=True)
    driver_id = db.Column(db.String, nullable=True)
    company_name = db.Column(db.String, nullable=False)
    company_branch = db.Column(db.Text, nullable=True)
    start_date = db.Column(db.DateTime, nullable=True)
    end_date = db.Column(db.DateTime, nullable=True)
    end_time = db.Column(db.Time, nullable=True)
    starting_point = db.Column(db.String, nullable=True)
    end_point = db.Column(db.String, nullable=True)
    way = db.Column(db.String, nullable=True)
    trip_type = db.Column(db.String, nullable=True)
    passenger_count = db.Column(db.Integer, nullable=False, default=1)
    distance_km = db.Column(db.Float, nullable=True)
    duration_min = db.Column(db.Integer, nullable=True)
    starting_lat = db.Column(db.Float, nullable=True)
    starting_lng = db.Column(db.Float, nullable=True)
    end_lat = db.Column(db.Float, nullable=True)
    end_lng = db.Column(db.Float, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    status_updated_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=True)
    driver_response = db.Column(db.String, nullable=True)
    driver_reason = db.Column(db.Text, nullable=True)
    driver_response_at = db.Column(db.DateTime, nullable=True)
    route_point = db.Column(db.Text, nullable=True)
    status = db.Column(db.String, nullable=True, default='scheduled')
    one_way_start_time = db.Column(db.Time, nullable=True)
    two_way_start_time = db.Column(db.Time, nullable=True)
    one_way_is_active = db.Column(db.Boolean, nullable=True)
    two_way_is_active = db.Column(db.Boolean, nullable=True)
    driver_response_two_way = db.Column(db.String, nullable=True)
    driver_reason_two_way = db.Column(db.Text, nullable=True)


class PostgresAgency(db.Model):
    __bind_key__ = 'postgres_db'
    __tablename__ = 'agencies'
    id = db.Column(db.String, primary_key=True)
    agency_name = db.Column(db.String, nullable=False)
    status = db.Column(db.String)


# Models
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    vehicle_number = db.Column(db.String(20))
    license_number = db.Column(db.String(50))
    is_driver = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Trip(db.Model):
    __tablename__ = 'trips'
    id = db.Column(db.Integer, primary_key=True)
    passenger_name = db.Column(db.String(100), nullable=False)
    passenger_phone = db.Column(db.String(20), nullable=False)
    pickup_location = db.Column(db.String(255), nullable=False)
    pickup_lat = db.Column(db.Float)
    pickup_lng = db.Column(db.Float)
    dropoff_location = db.Column(db.String(255), nullable=False)
    dropoff_lat = db.Column(db.Float)
    dropoff_lng = db.Column(db.Float)
    status = db.Column(db.String(20), default='pending')  # pending, accepted, rejected, completed
    fare = db.Column(db.Float)
    distance = db.Column(db.Float)
    driver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    accepted_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)

# Routes
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    user = User(
        name=data['name'],
        email=data['email'],
        password=generate_password_hash(data['password']),
        phone=data['phone'],
        vehicle_number=data.get('vehicle_number', ''),
        license_number=data.get('license_number', ''),
        is_driver=data.get('is_driver', True)
    )
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': 'User created successfully', 'user_id': user.id}), 201

@app.route('/api/auth/agencies', methods=['GET'])
def get_agencies():
    try:
        active_agencies = PostgresAgency.query.filter_by(status='Active').all()
        return jsonify([
            {
                'id': agency.id,
                'agency_name': agency.agency_name
            } for agency in active_agencies
        ]), 200
    except Exception as e:
        print(f"Error querying Postgres agencies: {e}")
        return jsonify([]), 200

@app.route('/api/auth/login', methods=['POST'])
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    
    if not user or not check_password_hash(user.password, data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    return jsonify({
        'message': 'Login successful',
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'phone': user.phone,
            'vehicle_number': user.vehicle_number,
            'license_number': user.license_number,
            'is_driver': user.is_driver
        }
    }), 200

@app.route('/api/trips', methods=['GET'])
def get_trips():
    status = request.args.get('status')  # If not provided, return all
    driver_id_param = request.args.get('driver_id')
    
    # 1. Query SQLite trips
    query = Trip.query
    if status:
        query = query.filter_by(status=status)
    if driver_id_param:
        try:
            # SQLite driver_id is an integer
            query = query.filter_by(driver_id=int(driver_id_param))
        except ValueError:
            pass

    sqlite_trips = query.order_by(Trip.created_at.desc()).all()
    
    results = []
    for trip in sqlite_trips:
        results.append({
            'id': trip.id,
            'passenger_name': trip.passenger_name,
            'passenger_phone': trip.passenger_phone,
            'pickup_location': trip.pickup_location,
            'pickup_lat': trip.pickup_lat,
            'pickup_lng': trip.pickup_lng,
            'dropoff_location': trip.dropoff_location,
            'dropoff_lat': trip.dropoff_lat,
            'dropoff_lng': trip.dropoff_lng,
            'status': trip.status,
            'fare': trip.fare,
            'distance': trip.distance,
            'created_at': trip.created_at.isoformat() if trip.created_at else datetime.utcnow().isoformat(),
            'source': 'sqlite'
        })

    # 2. Query PostgreSQL trip_schedules
    try:
        pg_query = TripSchedule.query
        
        if status:
            if status == 'pending':
                pg_query = pg_query.filter(
                    (TripSchedule.driver_response.is_(None) | 
                     (TripSchedule.driver_response == '') | 
                     (TripSchedule.driver_response == 'pending')) & 
                    (TripSchedule.is_active == True) &
                    (TripSchedule.status != 'completed')
                )
            elif status == 'accepted':
                pg_query = pg_query.filter(
                    (TripSchedule.driver_response == 'accepted') & 
                    (TripSchedule.is_active == True)
                )
            elif status == 'completed':
                pg_query = pg_query.filter(
                    (TripSchedule.is_active == False) | (TripSchedule.status == 'completed')
                )
        
        # If filtering by driver, map frontend's driverId to active Postgres driver
        if driver_id_param:
            # Map frontend driver ID '1' to PostgreSQL driver UUID 'cf6912d9-6617-482b-aacf-dd034c780185'
            target_driver_id = 'cf6912d9-6617-482b-aacf-dd034c780185'
            pg_query = pg_query.filter(TripSchedule.driver_id == target_driver_id)
            
        pg_trips = pg_query.order_by(TripSchedule.created_at.desc()).all()
        
        for ts in pg_trips:
            passenger_name = f"Company: {ts.company_name}"
            passenger_phone = "N/A"
            if ts.route_point:
                try:
                    import json
                    points = json.loads(ts.route_point)
                    if isinstance(points, list) and len(points) > 0:
                        names = [p.get('passenger_name') for p in points if p.get('passenger_name')]
                        phones = [p.get('passenger_phone') for p in points if p.get('passenger_phone')]
                        if names:
                            passenger_name = ", ".join(names)
                        if phones:
                            passenger_phone = ", ".join(phones)
                except Exception:
                    pass
            
            # Map status
            mapped_status = 'pending'
            if ts.driver_response == 'accepted':
                mapped_status = 'accepted'
            if not ts.is_active or ts.status == 'completed':
                mapped_status = 'completed'
                
            results.append({
                'id': ts.id,  # UUID string
                'passenger_name': passenger_name,
                'passenger_phone': passenger_phone,
                'pickup_location': ts.starting_point or 'Unknown',
                'pickup_lat': ts.starting_lat,
                'pickup_lng': ts.starting_lng,
                'dropoff_location': ts.end_point or 'Unknown',
                'dropoff_lat': ts.end_lat,
                'dropoff_lng': ts.end_lng,
                'status': mapped_status,
                'fare': round((ts.distance_km or 0.0) * 15.0, 2) if ts.distance_km else 100.0,
                'distance': round(ts.distance_km, 2) if ts.distance_km else None,
                'created_at': ts.created_at.isoformat() if ts.created_at else datetime.utcnow().isoformat(),
                'start_date': ts.start_date.isoformat() if ts.start_date else None,
                'start_time': ts.start_date.isoformat() if ts.start_date else None,
                'source': 'postgres',
                'company_name': ts.company_name,
                'trip_type': ts.trip_type,
                'way': ts.way
            })
    except Exception as e:
        print(f"Error querying Postgres trip_schedules: {e}")

    return jsonify(results), 200

@app.route('/api/trips/<trip_id>/accept', methods=['POST'])
def accept_trip(trip_id):
    data = request.get_json() or {}
    driver_id = data.get('driver_id')
    
    is_uuid = False
    try:
        if len(str(trip_id)) == 36 and '-' in str(trip_id):
            is_uuid = True
    except:
        pass
        
    if is_uuid:
        ts = TripSchedule.query.get(trip_id)
        if not ts:
            return jsonify({'error': 'Trip schedule not found'}), 404
            
        ts.driver_response = 'accepted'
        ts.driver_response_at = datetime.utcnow()
        # Map driver_id parameter to the postgres driver UUID
        ts.driver_id = 'cf6912d9-6617-482b-aacf-dd034c780185'
        db.session.commit()
        return jsonify({'message': 'Trip schedule accepted successfully'}), 200
    else:
        try:
            trip = Trip.query.get(int(trip_id))
        except ValueError:
            return jsonify({'error': 'Invalid trip ID format'}), 400
            
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        
        if trip.status != 'pending':
            return jsonify({'error': 'Trip is no longer available'}), 400
        
        trip.status = 'accepted'
        trip.driver_id = driver_id
        trip.accepted_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({'message': 'Trip accepted successfully'}), 200

@app.route('/api/trips/<trip_id>/reject', methods=['POST'])
def reject_trip(trip_id):
    data = request.get_json() or {}
    driver_id = data.get('driver_id')
    
    is_uuid = False
    try:
        if len(str(trip_id)) == 36 and '-' in str(trip_id):
            is_uuid = True
    except:
        pass
        
    if is_uuid:
        ts = TripSchedule.query.get(trip_id)
        if not ts:
            return jsonify({'error': 'Trip schedule not found'}), 404
            
        ts.driver_response = 'rejected'
        ts.driver_response_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'message': 'Trip schedule rejected successfully'}), 200
    else:
        try:
            trip = Trip.query.get(int(trip_id))
        except ValueError:
            return jsonify({'error': 'Invalid trip ID format'}), 400
            
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        
        if trip.status != 'pending':
            return jsonify({'error': 'Trip is no longer available'}), 400
        
        trip.status = 'rejected'
        
        db.session.commit()
        
        return jsonify({'message': 'Trip rejected successfully'}), 200

@app.route('/api/trips/<trip_id>/complete', methods=['POST'])
def complete_trip(trip_id):
    is_uuid = False
    try:
        if len(str(trip_id)) == 36 and '-' in str(trip_id):
            is_uuid = True
    except:
        pass
        
    if is_uuid:
        ts = TripSchedule.query.get(trip_id)
        if not ts:
            return jsonify({'error': 'Trip schedule not found'}), 404
            
        ts.is_active = False
        ts.status = 'completed'
        ts.status_updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'message': 'Trip schedule completed successfully'}), 200
    else:
        try:
            trip = Trip.query.get(int(trip_id))
        except ValueError:
            return jsonify({'error': 'Invalid trip ID format'}), 400
            
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        
        if trip.status != 'accepted':
            return jsonify({'error': 'Trip must be accepted first'}), 400
        
        trip.status = 'completed'
        trip.completed_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({'message': 'Trip completed successfully'}), 200

@app.route('/api/trips', methods=['POST'])
def create_trip():
    data = request.get_json()
    
    trip = Trip(
        passenger_name=data['passenger_name'],
        passenger_phone=data['passenger_phone'],
        pickup_location=data['pickup_location'],
        pickup_lat=data.get('pickup_lat'),
        pickup_lng=data.get('pickup_lng'),
        dropoff_location=data['dropoff_location'],
        dropoff_lat=data.get('dropoff_lat'),
        dropoff_lng=data.get('dropoff_lng'),
        fare=data.get('fare'),
        distance=data.get('distance')
    )
    
    db.session.add(trip)
    db.session.commit()
    
    db.session.commit()
    
    return jsonify({'message': 'Trip created successfully', 'trip_id': trip.id}), 201

# Initialize database
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
