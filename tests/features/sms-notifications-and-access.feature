@EPMCDMETST-69392
Feature: SMS notification status and access control
  As a receptionist
  I want to know whether the patient actually received the SMS
  So that I can call the patient myself when automatic delivery fails

  @AC-8 @backend-integration
  Scenario Outline: Unauthenticated requests are rejected on every appointment endpoint
    Given I am not logged in
    When I send <method> <path>
    Then the response status is 401
    And the error code is "UNAUTHORIZED" and the field is null

    Examples:
      | method | path                                  |
      | POST   | /api/appointments                     |
      | GET    | /api/appointments?phone=9876543210    |
      | GET    | /api/appointments/{id}                |
      | GET    | /api/appointments/{id}/sms            |
      | PATCH  | /api/appointments/{id}/cancel         |
      | PATCH  | /api/appointments/{id}/reschedule     |
      | GET    | /api/slots?doctorId=x&date=2027-08-02 |

  @AC-9 @backend-integration @unit
  Scenario Outline: failedAfterRetries is derived from status and attempt count
    Given the latest SMS log for the appointment is <status> with <attempts> attempts
    When I request the SMS status of the appointment
    Then the response status is 200
    And failedAfterRetries is <flag>

    Examples:
      | status  | attempts | flag  |
      | FAILED  | 1        | false |
      | FAILED  | 2        | false |
      | FAILED  | 3        | true  |
      | FAILED  | 4        | true  |
      | SENT    | 3        | false |
      | PENDING | 3        | false |

  @AC-9 @backend-integration @unit
  Scenario: No SMS has been logged yet
    Given the appointment has no SMS log
    When I request the SMS status of the appointment
    Then latest is null and failedAfterRetries is false

  @AC-9 @backend-integration
  Scenario: Unknown appointment
    When I request the SMS status of appointment "00000000-0000-4000-8000-000000000000"
    Then the response status is 404 with error code "APPOINTMENT_NOT_FOUND"

  @AC-9 @backend-integration @unit
  Scenario: SMS provider is not configured
    Given Twilio credentials are not set
    When an SMS is dispatched
    Then the SMS log is marked FAILED with attemptCount incremented
    And the booking response reports smsStatus "DISABLED"

  @AC-9 @ui
  Scenario Outline: Booking confirmation shows the SMS state
    When the booking response carries smsStatus "<status>"
    Then the banner state is "<state>"

    Examples:
      | status        | state         |
      | SENT          | SENT          |
      | PENDING_RETRY | PENDING_RETRY |
      | FAILED        | FAILED        |
      | DISABLED      | DISABLED      |

  @AC-9 @ui
  Scenario: A failed SMS escalates once retries are exhausted
    Given the booking response carries smsStatus "FAILED"
    When the UI polls the SMS status endpoint after 15 seconds and failedAfterRetries is true
    Then the banner state is "FAILED_AFTER_RETRIES" with role "alert"
    And the banner says to contact the patient manually
    And the banner cannot be dismissed
    And polling stops

  @AC-9 @ui
  Scenario: A pending SMS turns green once delivered
    Given the booking response carries smsStatus "PENDING_RETRY"
    When the UI polls and the backend reports SENT
    Then the banner state is "SENT"
    And polling stops

  @AC-9 @ui
  Scenario: A transient polling error does not hide the banner
    Given the booking response carries smsStatus "FAILED"
    When the SMS status request fails at the network level
    Then the banner state remains "FAILED"

  @AC-9 @ui
  Scenario: Cancel flow also surfaces a persistent SMS failure
    Given I cancelled an appointment and the cancellation SMS failed after 3 attempts
    Then the cancellation result shows the "FAILED_AFTER_RETRIES" banner
