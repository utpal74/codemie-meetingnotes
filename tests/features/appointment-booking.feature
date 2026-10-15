@EPMCDMETST-69392
Feature: Receptionist books appointments with optional doctor and slot
  As a receptionist
  I want to book an appointment for a patient, optionally letting the system pick the doctor and the slot
  So that patients are scheduled quickly without double-booking any doctor

  Background:
    Given I am logged in as the receptionist
    And the clinic works Monday to Saturday with 30-minute slots from 10:00 to 18:30
    And department "Cardiology" has doctors "Dr. Arjun Mehta" and "Dr. Priya Shah"

  @AC-1 @AC-3 @backend-integration @ui
  Scenario: Book with department only - system assigns doctor and slot
    When I book "Ravi Kumar" with phone "9876543210" in "Cardiology" on a Monday without choosing a doctor or a slot
    Then the response status is 201
    And the appointment status is "CONFIRMED"
    And the appointment has a unique appointment ID
    And the assigned doctor belongs to "Cardiology"
    And the assigned slot is one of the clinic slots
    And the confirmation shows the patient, doctor, department, date and time

  @AC-1 @backend-integration @ui
  Scenario: Book with a doctor but no slot - system assigns an open slot
    When I book "Ravi Kumar" with "Dr. Arjun Mehta" on a Monday without choosing a slot
    Then the response status is 201
    And the doctor is "Dr. Arjun Mehta"
    And the assigned slot is one of that doctor's open slots

  @AC-1 @backend-integration
  Scenario: Book with department and slot but no doctor - requested slot is honoured
    When I book "Ravi Kumar" in "Cardiology" at "12:30" on a Monday without choosing a doctor
    Then the response status is 201
    And the slot time is "12:30"

  @AC-1 @AC-3 @backend-integration @ui
  Scenario: Book with explicit doctor and slot (unchanged behaviour)
    When I book "Ravi Kumar" with "Dr. Arjun Mehta" at "14:00" on a Monday
    Then the response status is 201
    And the slot time is "14:00"

  @AC-1 @unit
  Scenario: Auto-assigned slot is never already booked
    Given "Dr. Arjun Mehta" is booked for every slot on a Monday except "10:00"
    When I book "Ravi Kumar" with "Dr. Arjun Mehta" on that Monday without choosing a slot
    Then the slot time is "10:00"

  @AC-1 @backend-integration @unit
  Scenario: Random doctor is only chosen among doctors free at the requested slot
    Given every Cardiology doctor except "Dr. Priya Shah" is booked at "12:00" on a Monday
    When I book "Ravi Kumar" in "Cardiology" at "12:00" on that Monday without choosing a doctor
    Then the doctor is "Dr. Priya Shah"

  @AC-1 @backend-integration @ui
  Scenario: No slots left for the chosen doctor
    Given "Dr. Arjun Mehta" is fully booked on a Monday
    When I book "Ravi Kumar" with "Dr. Arjun Mehta" on that Monday without choosing a slot
    Then the response status is 409
    And the error code is "NO_SLOTS_AVAILABLE" on field "slotTime"
    And the form keeps my input and shows the message under the slot field

  @AC-1 @backend-integration @ui
  Scenario: Every doctor in the department is full for the day
    Given every doctor in "Cardiology" is fully booked on a Monday
    When I book "Ravi Kumar" in "Cardiology" on that Monday without choosing a doctor or a slot
    Then the response status is 409
    And the error code is "NO_SLOTS_AVAILABLE"

  @AC-1 @backend-integration
  Scenario: Unknown department has no doctors
    When I book "Ravi Kumar" in an unknown department without choosing a doctor
    Then the response status is 409
    And the error code is "NO_DOCTOR_AVAILABLE" on field "departmentId"

  @AC-1 @backend-integration
  Scenario: Unknown doctor
    When I book "Ravi Kumar" with an unknown doctor ID at "14:00"
    Then the response status is 404
    And the error code is "DOCTOR_NOT_FOUND" on field "doctorId"

  @AC-1 @backend-integration @unit
  Scenario: Neither doctor nor department supplied
    When I book "Ravi Kumar" without a doctor and without a department
    Then the response status is 422
    And the error code is "VALIDATION_ERROR" on field "departmentId"

  @AC-1 @ui @gap
  Scenario: Any doctor selected but not any slot (KNOWN GAP - pending fix)
    Given I tick "Any doctor" but leave "Any available slot" unticked
    When I submit the booking form
    Then the form must not post an empty slotTime
