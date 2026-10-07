Feature: Booking flow respects active-only doctor and department filter
  Story EPMCDMETST-68125
  As a receptionist
  I want the booking flow to only present active doctors in active departments
  So that patients cannot be booked with unavailable practitioners

  @filter @AC7
  Scenario: Receptionist department list shows only active departments
    Given a receptionist session is active
    And an active department named "Cardiology" exists
    And an inactive department named "Bone Health" exists
    When a receptionist sends GET to "/api/departments"
    Then the response status is 200
    And the response contains a department named "Cardiology"
    And the response does not contain a department named "Bone Health"

  @filter @AC14
  Scenario: Receptionist doctor list shows only active doctors in active departments
    Given a receptionist session is active
    And an active department named "General Medicine" exists
    And an active doctor named "Dr. Priya Sharma" in active department "General Medicine"
    And an inactive doctor named "Dr. Rajesh Patel" in active department "General Medicine"
    When a receptionist sends GET to "/api/doctors"
    Then the response contains a doctor named "Dr. Priya Sharma"
    And the response does not contain a doctor named "Dr. Rajesh Patel"

  @filter @AC15
  Scenario: Doctor in inactive department excluded from receptionist list
    Given a receptionist session is active
    And an inactive department named "Bone Health" exists
    And an active doctor named "Dr. Arun Mehta" in inactive department "Bone Health"
    When a receptionist sends GET to "/api/doctors"
    Then the response does not contain a doctor named "Dr. Arun Mehta"

  @filter @AC13 @AC14
  Scenario: After admin deactivates a doctor the receptionist no longer sees them
    Given an admin session is active
    And an active doctor named "Dr. Priya Sharma" in active department "General Medicine"
    When the admin sets the doctor status to inactive
    Then the response status is 200
    And a receptionist sending GET to "/api/doctors" does not see "Dr. Priya Sharma"

  @filter @AC5 @AC7
  Scenario: After admin deactivates a department the receptionist no longer sees it
    Given an admin session is active
    And an active department named "Cardiology" exists
    When the admin sets the department status to inactive
    Then the response status is 200
    And a receptionist sending GET to "/api/departments" does not see "Cardiology"
