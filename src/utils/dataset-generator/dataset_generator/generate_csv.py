import pandas as pd
import random

# Define column names
columns = ['Hospital', 'Diagnosis', 'Treatment', 'Recovery Time']

# Generate data with broader hospital, diagnosis, and treatment lists
hospitals = [
    'General Hospital', 'City Hospital', 'Northside Hospital', 'West End Medical Center', 
    'Southside Clinic', 'Eastside Health Center', 'Pine Valley Hospital', 'Lakeside Medical', 
    'Riverside Hospital', 'Greenwood Medical Center', 'Downtown Medical Plaza', 'Suburban Hospital',
    'Mountain View Health', 'Oceanview Clinic', 'Uptown Medical', 'Hilltop Hospital', 
    'Metro Health Clinic', 'Parkview Hospital', 'Sunrise Medical Center', 'Grandview Hospital'
]

diagnoses = [
    'Hypertension', 'Diabetes', 'Asthma', 'Pneumonia', 'COVID-19', 'Heart Disease', 
    'Chronic Kidney Disease', 'Stroke', 'COPD', 'Cancer', 'Anxiety', 'Depression', 
    'Arthritis', 'Obesity', 'Alzheimer', 'Epilepsy', 'Migraine', 'Tuberculosis', 
    'Liver Cirrhosis', 'Leukemia'
]

treatments = [
    'Medication A', 'Medication B', 'Therapy A', 'Therapy B', 'Surgery A', 'Surgery B', 
    'Rehabilitation A', 'Rehabilitation B', 'Medication C', 'Therapy C', 'Surgery C', 
    'Rehabilitation C', 'Medication D', 'Therapy D', 'Surgery D'
]

# Create random data for 1,000,000 rows which size is around 48 MB
# Modify this line depending the number of rows and file size you'd like to test against
data = []
rows = 1000000
for _ in range(rows):  # Generate 1,000,000 rows
    hospital = random.choice(hospitals)
    diagnosis = random.choice(diagnoses)
    treatment = random.choice(treatments)
    recovery_time = random.randint(5, 60)  # Random recovery time between 5 and 60 days
    data.append([hospital, diagnosis, treatment, recovery_time])

# Create DataFrame
df = pd.DataFrame(data, columns=columns)

# Save to CSV
df.to_csv(f"rows_{rows}_medical_records.csv", index=False)
