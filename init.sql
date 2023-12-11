CREATE DATABASE mydb;
\c mydb
CREATE TABLE entity(
  entityId SERIAL PRIMARY KEY,
  entityName VARCHAR(100) NOT NULL,
  entityFolder VARCHAR(100) NOT NULL,
  entityType VARCHAR(100) NOT NULL,
  entityPath VARCHAR(100) NOT NULL,
  entityUser VARCHAR(100) NOT NULL
);
CREATE TABLE noruuser(
  userId SERIAL PRIMARY KEY,
  userName VARCHAR(100) NOT NULL,
  userPassword VARCHAR(100) NOT NULL
);