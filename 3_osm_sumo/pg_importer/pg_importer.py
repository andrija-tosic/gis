import configparser
import psycopg2
import re
import lxml.etree as ET
from util import print_progress_bar
from datetime import datetime, timedelta, timezone

# Read configuration file
config = configparser.ConfigParser()
config.read("import.conf")

# Connect to the PostgreSQL database
conn = psycopg2.connect(
    dbname=config['database']['dbname'],
    user=config['database']['user'],
    # password=config['database']['password'],
    host=config['database']['host'],
    port=config['database']['port']
)

db = conn.cursor()
table_name = config['import']['table_name']

# Clean up the database
print("db cleanup")
db.execute(f"DROP TABLE IF EXISTS {table_name};")

# id SERIAL PRIMARY KEY,

# Create table
print(f"creating table {table_name}")
db.execute(f"""
  CREATE TABLE IF NOT EXISTS {table_name} (
      osm_id VARCHAR(20),
      osm_obj VARCHAR(20),
      timestamp TIMESTAMP,                 
      obj_type VARCHAR(50),            
      speed FLOAT,
      angle FLOAT,              
      lane_or_edge BIGINT NULL,
      way GEOMETRY(Point, 3857)
  )
""")
print(f"creating hypertable {table_name}")
db.execute(f"SELECT create_hypertable('{table_name}', by_range('timestamp'));")

# Create indexes if not skipped
if not config['import'].getboolean('skip_index_creation'):
    print(f"creating index {table_name}_timestamp_idx")
    db.execute(f"CREATE INDEX IF NOT EXISTS {table_name}_timestamp_idx ON {table_name} (timestamp);")

    print(f"creating index {table_name}_obj_type_idx")
    db.execute(f"CREATE INDEX IF NOT EXISTS {table_name}_obj_type_idx ON {table_name} (obj_type);")

    print(f"creating index {table_name}_way_idx")
    db.execute(f"CREATE INDEX IF NOT EXISTS {table_name}_way_idx ON {table_name} (way);")

    print(f"creating index {table_name}_speed_idx")
    db.execute(f"CREATE INDEX IF NOT EXISTS {table_name}_speed_idx ON {table_name} (speed);")

    print(f"creating index {table_name}_lane_or_edge_idx")
    db.execute(f"CREATE INDEX IF NOT EXISTS {table_name}_lane_or_edge_idx ON {table_name} (lane_or_edge);")

    # Indexes for vehicles
    print(f"creating index {table_name}_osm_id_idx")
    db.execute(f"CREATE INDEX IF NOT EXISTS {table_name}_osm_id_idx ON {table_name} (osm_id);")

else:
    print('skipping index creation')

# Prepare insert query
insert_query = f"""
    INSERT INTO {table_name} (osm_id, osm_obj, timestamp, obj_type, speed, angle, lane_or_edge, way)
    VALUES (%s, %s, %s, %s, %s, %s, %s, ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 3857))
"""

total_lines=0 
data_count=0

# Read data from the file
file_path = config['file']['path']
with open(file_path, 'r') as fin:
    for line in fin:
        total_lines += 1
        data_count += line.count('<vehicle id') + line.count('<person id')

print(total_lines, data_count)

context = ET.iterparse(source=file_path, events=("end",), tag="timestep")
current_time_utc = datetime.now(timezone.utc)
imported = 0

print("importing data")
for (event, timestep) in context:
    sim_time = float(timestep.attrib['time'])
    timestamp = current_time_utc + timedelta(seconds=int(sim_time))

    for obj in timestep:
        osm_obj = obj.tag
        osm_id = obj.attrib['id']
        obj_lat = float(obj.attrib['y'])
        obj_lon = float(obj.attrib['x'])
        obj_angle = float(obj.attrib['angle'])
        obj_speed = float(obj.attrib['speed'])
        obj_type = obj.attrib.get('type', 'person')
        
        lane_or_edge = None
        if 'lane' in obj.attrib and re.search(r'^-?\d+', obj.attrib['lane']):
            lane_or_edge = abs(int(re.search(r'^-?\d+', obj.attrib['lane']).group(0)))
        
        if 'edge' in obj.attrib and re.search(r'^-?\d+', obj.attrib['edge']):
            lane_or_edge = abs(int(re.search(r'^-?\d+', obj.attrib['edge']).group(0)))
        
        imported += 1
        db.execute(insert_query, (osm_id, osm_obj, timestamp, obj_type, obj_speed, obj_angle, lane_or_edge, obj_lon, obj_lat))

    print_progress_bar(imported, total_lines, prefix='Progress: ', decimals=2, length=50)
    timestep.clear()

# Commit the transaction
print("committing insert")
conn.commit()
print("operations completed")
