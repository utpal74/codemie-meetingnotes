@EPMCDMETST-69392
Feature: Receptionist looks up, cancels and reschedules appointments
  As a receptionist
  I want to find, cancel and reschedule a patient appointment
  So that the schedule stays accurate and the patient is told about every change

  Background:
    Given I am logged in as the receptionist
    And "Ravi Kumar" with phone "9876543210" has a CONFIRMED appointment with "Dr. Arjun Mehta" at "13:00" on a Monday

  @AC-5 @backend-integration @ui
  Scenario: Find by appointment ID
    When I look up the appointment by its ID
    Then I see the patient, doctor, department, date, time and status "CONFIRMED"

  @AC-5 @backend-integration @ui
  Scenario: Find by phone number
    When I search by phone "9876543210"
    Then I see one appointment for "Ravi Kumar"
    And the patient phone number is not present in the response

  @AC-5 @backend-integration @ui
  Scenario: Unknown ID or phone
    When I look up appointment ID "00000000-0000-4000-8000-000000000000"
    Then the response status is 404 with error code "APPOINTMENT_NOT_FOUND"
    And searching phone "9000099999" returns an empty list

  @AC-5 @backend-integration
  Scenario: Phone search without a phone parameter
    When I search appointments without a phone parameter
    Then the response status is 422 with error code "MISSING_PARAMS" on field "phone"

  @AC-6 @backend-integration @ui
  Scenario: Cancel releases the slot and sends a cancellation SMS
    When I cancel the appointment
    Then the appointment status is "CANCELLED"
    And the response includes an smsStatus
    And a CANCELLATION SMS log exists for the appointment
    And the 13:00 slot is available again for "Dr. Arjun Mehta" on that Monday

  @AC-6 @backend-integration @ui
  Scenario: Cancelled appointments leave the default lookup but stay in history
    Given the appointment is cancelled
    When I search by phone "9876543210"
    Then no appointments are listed
    But searching with history included lists the CANCELLED appointment

  @AC-6 @backend-integration @unit @ui
  Scenario Outline: Cancelling twice is rejected
    Given the appointment is <state>
    When I cancel the appointment
    Then the response status is 409 with error code "APPOINTMENT_ALREADY_CANCELLED"

    Examples:
      | state       |
      | CANCELLED   |
      | RESCHEDULED |

  @AC-6 @ui
  Scenario: Declining the confirmation dialog changes nothing
    When I choose "Cancel Appointment" and decline the confirmation
    Then no cancel request is sent

  @AC-7 @backend-integration @ui
  Scenario: Reschedule creates a new linked appointment and releases the old slot
    When I reschedule it to "11:00" on the next Tuesday
    Then the response status is 201
    And a new CONFIRMED appointment exists with a different ID
    And the new appointment previousAppointmentId is the original ID
    And the original appointment is "RESCHEDULED"
    And the 13:00 slot on the original Monday is available again
    And the 11:00 slot on the Tuesday is no longer available

  @AC-7 @backend-integration
  Scenario: Reschedule SMS is logged against the new appointment
    When I reschedule it to "11:00" on the next Tuesday
    Then the response includes an smsStatus
    And a RESCHEDULING SMS log exists for the new appointment

  @AC-7 @backend-integration
  Scenario: Reschedule chain keeps every link
    When I reschedule it to "11:00" on the next Tuesday
    And I reschedule the new appointment to "16:30" on the next Wednesday
    Then the third appointment links to the second and the second to the first
    And only the third appointment is CONFIRMED

  @AC-7 @backend-integration @unit @ui
  Scenario: Reschedule into an occupied slot is rejected and nothing changes
    Given another patient holds "11:00" with "Dr. Arjun Mehta" on the next Tuesday
    When I reschedule it to "11:00" on the next Tuesday
    Then the response status is 409 with error code "SLOT_UNAVAILABLE"
    And the original appointment is still "CONFIRMED"
    And no RESCHEDULING SMS was logged

  @AC-7 @backend-integration
  Scenario: Reschedule onto its own current slot is rejected
    When I reschedule it to "13:00" on the same Monday
    Then the response status is 409 with error code "SLOT_UNAVAILABLE"

  @AC-7 @backend-integration @ui
  Scenario: Reschedule to an out-of-hours slot is rejected
    When I reschedule it to "19:00" on the next Tuesday
    Then the response status is 422
    And the original appointment is still "CONFIRMED"

  @AC-7 @gap
  Scenario: Rescheduling an already CANCELLED appointment (KNOWN GAP - pending decision)
    Given the appointment is CANCELLED
    When I reschedule it to "11:00" on the next Tuesday
    Then the request should be rejected
