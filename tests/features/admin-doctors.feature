Feature: Admin manages Doctors
  Story EPMCDMETST-68125
  As an admin user
  I want to create, edit, activate, and deactivate doctors
  So that only active doctors in active departments appear in the booking flow

  Background:
    Given the application is running
    And an active department named "General Medicine" exists

  @auth @AC1
  Scenario: Unauthenticated user cannot access admin doctor endpoints
    Given no session cookie is present
    When I send GET to "/api/admin/doctors"
    Then the response status is 401
    And the response body contains error code "UNAUTHORIZED"

  @auth @AC1
  Scenario: Receptionist cannot access admin doctor endpoints
    Given a receptionist session is active
    When I send GET to "/api/admin/doctors"
    Then the response status is 403
    And the response body contains error code "FORBIDDEN"

  @read
  Scenario: Admin list returns all doctors including inactive
    Given an admin session is active
    And the following doctors exist in department "General Medicine":
      | name              | isActive |
      | Dr. Priya Sharma  | true     |
      | Dr. Rajesh Patel  | false    |
    When I send GET to "/api/admin/doctors"
    Then the response status is 200
    And the response contains a doctor named "Dr. Priya Sharma" with isActive "true"
    And the response contains a doctor named "Dr. Rajesh Patel" with isActive "false"
  @read @AC16
  Scenario: Admin filters by status=active
    Given an admin session is active
    And doctor "Dr. Priya Sharma" is active in department "General Medicine"
    And doctor "Dr. Rajesh Patel" is inactive in department "General Medicine"
    When I send GET to "/api/admin/doctors?status=active"
    Then the response status is 200
    And every doctor in the response has isActive equal to true

  @read @AC16
  Scenario: Admin filters by status=inactive
    Given an admin session is active
    And doctor "Dr. Priya Sharma" is active in department "General Medicine"
    And doctor "Dr. Rajesh Patel" is inactive in department "General Medicine"
    When I send GET to "/api/admin/doctors?status=inactive"
    Then the response status is 200
    And every doctor in the response has isActive equal to false

  @read @AC17
  Scenario: Admin filters by departmentId
    Given an admin session is active
    And an active department named "Bone Health" exists
    And doctor "Dr. Arun Mehta" is active in department "Bone Health"
    When I send GET to "/api/admin/doctors" with a departmentId filter for "Bone Health"
    Then the response status is 200
    And every doctor in the response belongs to department "Bone Health"

  @create @AC8
  Scenario: Admin creates a doctor with valid name and department
    Given an admin session is active
    When the admin creates doctor "Dr. Priya Sharma" in department "General Medicine"
    Then the response status is 201
    And the response body field "name" equals "Dr. Priya Sharma"
    And the response body field "isActive" equals "true"

  @create @AC9
  Scenario: Admin cannot create a doctor with non-existent departmentId
    Given an admin session is active
    When the admin creates doctor "Dr. Ghost" with departmentId "00000000-0000-0000-0000-000000000000"
    Then the response status is 404
    And the response body contains error code "DEPARTMENT_NOT_FOUND"

  @create @validation
  Scenario: Doctor name of 1 character is rejected
    Given an admin session is active
    When the admin creates doctor "X" in department "General Medicine"
    Then the response status is 422
    And the response body contains a validation error for field "name"

  @create @validation
  Scenario: Doctor departmentId must be a valid UUID
    Given an admin session is active
    When the admin creates doctor "Dr. Test" with departmentId "not-a-uuid"
    Then the response status is 422
    And the response body contains a validation error for field "departmentId"

  @update @AC10
  Scenario: Admin edits a doctor name
    Given an admin session is active
    And a doctor named "Dr. Old Name" exists in department "General Medicine"
    When the admin renames the doctor to "Dr. New Name"
    Then the response status is 200
    And the response body field "name" equals "Dr. New Name"

  @update @AC10
  Scenario: Admin reassigns a doctor to a different department
    Given an admin session is active
    And an active department named "Cardiology" exists
    And a doctor named "Dr. Priya Sharma" exists in department "General Medicine"
    When the admin moves doctor "Dr. Priya Sharma" to department "Cardiology"
    Then the response status is 200
    And the response body includes department name "Cardiology"

  @update @AC9
  Scenario: Admin cannot reassign to non-existent department
    Given an admin session is active
    And a doctor named "Dr. Priya Sharma" exists in department "General Medicine"
    When the admin sets the doctor departmentId to "00000000-0000-0000-0000-000000000000"
    Then the response status is 404
    And the response body contains error code "DEPARTMENT_NOT_FOUND"

  @update
  Scenario: PATCH to non-existent doctor returns 404
    Given an admin session is active
    When the admin updates doctor with id "00000000-0000-0000-0000-000000000000"
    Then the response status is 404
    And the response body contains error code "DOCTOR_NOT_FOUND"

  @status @AC11
  Scenario: Admin deactivates an active doctor
    Given an admin session is active
    And an active doctor named "Dr. Priya Sharma" in department "General Medicine"
    When the admin sets the doctor status to inactive
    Then the response status is 200
    And the response body field "isActive" equals "false"

  @status @AC12
  Scenario: Admin activates an inactive doctor when department is active
    Given an admin session is active
    And an inactive doctor named "Dr. Rajesh Patel" in active department "General Medicine"
    When the admin sets the doctor status to active
    Then the response status is 200
    And the response body field "isActive" equals "true"

  @status @AC13
  Scenario: Admin cannot activate a doctor whose department is inactive
    Given an admin session is active
    And an inactive department named "Bone Health" exists
    And an inactive doctor named "Dr. Arun Mehta" in department "Bone Health"
    When the admin sets the doctor status to active
    Then the response status is 409
    And the response body contains error code "DEPARTMENT_INACTIVE"

  @status
  Scenario: Status PATCH to non-existent doctor returns 404
    Given an admin session is active
    When the admin sets status on doctor with id "00000000-0000-0000-0000-000000000000" to active
    Then the response status is 404
    And the response body contains error code "DOCTOR_NOT_FOUND"

  @filter @AC14
  Scenario: Receptionist list excludes inactive doctors
    Given a receptionist session is active
    And an active doctor named "Dr. Priya Sharma" in active department "General Medicine"
    And an inactive doctor named "Dr. Rajesh Patel" in active department "General Medicine"
    When a receptionist sends GET to "/api/doctors"
    Then the response contains a doctor named "Dr. Priya Sharma"
    And the response does not contain a doctor named "Dr. Rajesh Patel"

  @filter @AC15
  Scenario: Receptionist list excludes doctors in inactive departments
    Given a receptionist session is active
    And an inactive department named "Bone Health" exists
    And an active doctor named "Dr. Arun Mehta" in inactive department "Bone Health"
    When a receptionist sends GET to "/api/doctors"
    Then the response does not contain a doctor named "Dr. Arun Mehta"

  @history @AC18
  Scenario: Historical appointments still reference inactive doctor data
    Given a confirmed appointment referencing inactive doctor "Dr. Rajesh Patel"
    When the receptionist fetches the appointment details
    Then the response status is 200
    And the appointment response includes doctor name "Dr. Rajesh Patel"
