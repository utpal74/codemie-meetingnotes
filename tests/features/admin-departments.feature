Feature: Admin manages Departments
  Story EPMCDMETST-68125
  As an admin user
  I want to create, edit, activate, and deactivate departments
  So that the clinic department catalogue stays accurate and receptionist booking flows only see active departments

  Background:
    Given the application is running
    And an admin session is active

  @auth @AC1
  Scenario: Unauthenticated user cannot access admin department endpoints
    Given no session cookie is present
    When I send GET to "/api/admin/departments"
    Then the response status is 401
    And the response body contains error code "UNAUTHORIZED"

  @auth @AC1
  Scenario: Receptionist cannot access admin department endpoints
    Given a receptionist session is active
    When I send GET to "/api/admin/departments"
    Then the response status is 403
    And the response body contains error code "FORBIDDEN"

  @auth @AC1
  Scenario: Admin can access admin department list
    Given an admin session is active
    When I send GET to "/api/admin/departments"
    Then the response status is 200
    And the response body is a JSON array

  @read @AC7
  Scenario: Admin list includes both active and inactive departments
    Given the following departments exist:
      | name        | isActive |
      | Cardiology  | true     |
      | Bone Health | false    |
    When I send GET to "/api/admin/departments"
    Then the response status is 200
    And the response contains a department named "Cardiology" with isActive "true"
    And the response contains a department named "Bone Health" with isActive "false"

  @create @AC2
  Scenario: Admin creates a department with a valid unique name
    When I POST to "/api/admin/departments" with JSON body:
      | field | value     |
      | name  | Neurology |
    Then the response status is 201
    And the response body field "name" equals "Neurology"
    And the response body field "isActive" equals "true"

  @create @AC3
  Scenario: Admin cannot create a department with an exact duplicate name
    Given a department named "Cardiology" exists
    When I POST to "/api/admin/departments" with JSON body:
      | field | value      |
      | name  | Cardiology |
    Then the response status is 409
    And the response body contains error code "DEPARTMENT_NAME_TAKEN"
    And the error field is "name"

  @create @AC3
  Scenario: Admin cannot create a department with a case-insensitive duplicate name
    Given a department named "Cardiology" exists
    When I POST to "/api/admin/departments" with JSON body:
      | field | value      |
      | name  | cardiology |
    Then the response status is 409
    And the response body contains error code "DEPARTMENT_NAME_TAKEN"

  @create @validation @AC21
  Scenario: Department name of 1 character is rejected
    When I POST to "/api/admin/departments" with JSON body:
      | field | value |
      | name  | X     |
    Then the response status is 422
    And the response body contains a validation error for field "name"

  @create @validation @AC21
  Scenario: Department name of 101 characters is rejected
    When I POST to "/api/admin/departments" with a name of 101 characters
    Then the response status is 422
    And the response body contains a validation error for field "name"

  @create @validation @AC21
  Scenario: Department name of exactly 2 characters is accepted
    When I POST to "/api/admin/departments" with JSON body:
      | field | value |
      | name  | ED    |
    Then the response status is 201

  @update @AC4
  Scenario: Admin edits a department name
    Given a department named "Old Name Dept" exists
    When the admin renames the department to "New Name Dept"
    Then the response status is 200
    And the response body field "name" equals "New Name Dept"

  @update @AC4
  Scenario: Admin cannot rename a department to a name already taken case-insensitively
    Given a department named "Cardiology" exists
    And a department named "Neurology" exists
    When the admin renames "Neurology" to "cardiology"
    Then the response status is 409
    And the response body contains error code "DEPARTMENT_NAME_TAKEN"

  @update
  Scenario: PATCH to a non-existent department returns 404
    When the admin updates department id "00000000-0000-0000-0000-000000000000" with name "Ghost"
    Then the response status is 404
    And the response body contains error code "DEPARTMENT_NOT_FOUND"

  @status @AC5
  Scenario: Admin deactivates an active department
    Given an active department named "Cardiology" exists
    When the admin sets the department status to inactive
    Then the response status is 200
    And the response body field "isActive" equals "false"

  @status @AC6
  Scenario: Admin activates an inactive department
    Given an inactive department named "Bone Health" exists
    When the admin sets the department status to active
    Then the response status is 200
    And the response body field "isActive" equals "true"

  @status
  Scenario: Status PATCH to a non-existent department returns 404
    When the admin sets status on department id "00000000-0000-0000-0000-000000000000" to inactive
    Then the response status is 404
    And the response body contains error code "DEPARTMENT_NOT_FOUND"

  @status @validation
  Scenario: Status PATCH with missing isActive field returns 422
    Given an active department named "Cardiology" exists
    When the admin sends a status PATCH with an empty body
    Then the response status is 422

  @filter @AC7
  Scenario: Receptionist list excludes deactivated departments
    Given an active department named "Cardiology" exists
    And an inactive department named "Bone Health" exists
    When a receptionist sends GET to "/api/departments"
    Then the response status is 200
    And the response contains a department named "Cardiology"
    And the response does not contain a department named "Bone Health"
