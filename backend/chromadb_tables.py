import sqlite3

conn = sqlite3.connect('chroma_db/chroma.sqlite3')

cursor = conn.cursor()

cursor.execute("SELECT name from sqlite_master where type='table';")

tables = cursor.fetchall()
print(tables)

cursor.execute("SELECT * FROM collections;")

rows = cursor.fetchall()

for row in rows:
    print(row)