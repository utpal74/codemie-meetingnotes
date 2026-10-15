@EPMCDMETST-69392
Feature: Booking rules - working hours, validation and double-booking prevention
  As a receptionist
  I want invalid bookings rejected with clear errors
  So that no patient is booked outside clinic hours or into an occupied slot

  Background:
    Given I am logged in as the receptionist

  @AC-2 @backend-integration @unit
  Scenario Outline: Sundays are rejected
    When I <action> on a Sunday
    Then the response status is 422
    And the error code is "<code>" on field "<field>"

    Examples:
      | action                         | code             | field           |
      | book with doctor and slot      | VALIDATION_ERROR | appointmentDate |
      | book with department only      | VALIDATION_ERROR | appointmentDate |
      | reschedule an appointment      | VALIDATION_ERROR | appointmentDate |
      | list slots for a doctor        | INVALID_DATE     | date            |

  @AC-2 @backend-integration
  Scenario: Working days expose 18 slots from 10:00 to 18:30
    When I list slots for "Dr. Arjun Mehta" on a Monday
    Then I see 18 slots
    And the first slot is "10:00" and the last slot is "18:30"

  @AC-2 @backend-integration
  Scenario: Saturday is a working day
    When I list slots for "Dr. Arjun Mehta" on a Saturday
    Then I see 18 slots

  @AC-2 @backend-integration
  Scenario Outline: Boundary slots are bookable
    When I book "Meera Nair" with "Dr. Arjun Mehta" at "<slot>" on a Saturday
    Then the response status is 201

    Examples:
      | slot  |
      | 10:00 |
      | 18:30 |

  @AC-2 @backend-integration @unit
  Scenario Outline: Slots outside the clinic grid are rejected
    When I book "Meera Nair" with "Dr. Arjun Mehta" at "<slot>" on a Monday
    Then the response status is 422

    Examples:
      | slot  |
      | 09:30 |
      | 19:00 |
      | 10:15 |
      | 23:30 |

  @AC-2 @backend-integration @unit
  Scenario: Past dates are rejected
    When I book "Meera Nair" with "Dr. Arjun Mehta" at "14:00" on a past date
    Then the response status is 422
    And the error code is "VALIDATION_ERROR" on field "appointmentDate"

  @AC-2 @backend-integration @unit
  Scenario Outline: Invalid patient data is rejected
    When I book with patient phone "<phone>" and name "<name>"
    Then the response status is 422
    And the error is reported on field "<field>"

    Examples:
      | phone      | name       | field        |
      | 12345      | Ravi Kumar | patientPhone |
      | 5876543210 | Ravi Kumar | patientPhone |
      | 9876543210 | R          | patientName  |

  @AC-4 @backend-integration
  Scenario: Sequential double booking is rejected
    Given "Dr. Arjun Mehta" is booked at "16:00" on a Monday
    When I book another patient with "Dr. Arjun Mehta" at "16:00" on that Monday
    Then the response status is 409
    And the error code is "SLOT_UNAVAILABLE" on field "slotTime"

  @AC-4 @backend-integration
  Scenario: Six simultaneous bookings of one slot - exactly one wins
    When 6 receptionists book "Dr. Arjun Mehta" at "10:00" on a Monday at the same moment
    Then exactly one response has status 201
    And the other 5 responses have status 409 with error code "SLOT_UNAVAILABLE"
    And the database holds exactly one CONFIRMED appointment for that slot

  @AC-4 @backend-integration
  Scenario: Simultaneous "any slot" bookings never share a slot
    When 6 receptionists book "Dr. Arjun Mehta" on a Monday without choosing a slot at the same moment
    Then no response is a server error
    And no two CONFIRMED appointments share the same doctor, date and slot

  @AC-4 @AC-7 @backend-integration
  Scenario: Two reschedules into the same slot - one wins and the loser is untouched
    Given two CONFIRMED appointments for "Dr. Arjun Mehta" on a Monday
    When both are rescheduled to "15:00" on the next Tuesday at the same moment
    Then one response has status 201 and the other 409 "SLOT_UNAVAILABLE"
    And the appointment that lost is still CONFIRMED

  @AC-4 @unit
  Scenario: Database serialization failure maps to the same 409 envelope
    Given the database reports a serialization failure
    When a booking is attempted
    Then the response status is 409 with error code "SLOT_UNAVAILABLE"

  @AC-1 @AC-4 @unit
  Scenario: Auto-assigned booking retries up to 3 times after losing a race
    Given an auto-assigned slot is taken by someone else during the booking
    When the booking is retried
    Then it succeeds on a later attempt
    But after 3 lost races it fails with 409 "SLOT_UNAVAILABLE"
