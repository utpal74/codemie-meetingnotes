Feature: Admin UI pages for Departments and Doctors
  Story EPMCDMETST-68125
  As an admin user navigating the browser UI
  I want to manage departments and doctors through admin pages

  Background:
    Given the browser is open on the admin application
    And the admin user is logged in

  @ui @AC19
  Scenario: Departments page loads with table and New button
    When the admin navigates to /admin/departments
    Then the page heading Departments is visible
    And the table has columns Name Status and Actions
    And the New button is visible

  @ui @AC19
  Scenario: Admin searches departments by name
    Given departments Cardiology and Bone Health exist
    When the admin navigates to /admin/departments
    And the admin types Card in the search box
    Then only Cardiology appears in the table
    And Bone Health is not visible

  @ui @AC19
  Scenario: Admin creates a department via the New modal
    When the admin navigates to /admin/departments
    And the admin clicks the New button
    Then the modal titled New Department appears
    When the admin fills the Name field with Neurology
    And the admin clicks Save
    Then the modal closes
    And Neurology appears in the table with status Active

  @ui @AC3 @AC19
  Scenario: Duplicate name shows inline error in create modal
    Given a department named Cardiology exists
    When the admin navigates to /admin/departments
    And the admin clicks the New button
    And the admin fills the Name field with Cardiology
    And the admin clicks Save
    Then the modal remains open
    And the error text Department name already exists. is visible

  @ui @AC4 @AC19
  Scenario: Admin edits a department name via Edit modal
    Given a department named Cardiology exists
    When the admin navigates to /admin/departments
    And the admin clicks Edit for Cardiology
    Then the Edit Department modal opens pre-filled with Cardiology
    When the admin clears the name and types Cardiology Updated
    And the admin clicks Save
    Then the modal closes
    And Cardiology Updated appears in the table

  @ui @AC5 @AC19
  Scenario: Admin deactivates a department
    Given an active department named Cardiology exists
    When the admin navigates to /admin/departments
    Then the Cardiology row shows status Active and button Deactivate
    When the admin clicks Deactivate for Cardiology
    Then the Cardiology row shows status Inactive and button Activate

  @ui @AC6 @AC19
  Scenario: Admin activates an inactive department
    Given an inactive department named Bone Health exists
    When the admin navigates to /admin/departments
    Then the Bone Health row shows status Inactive and button Activate
    When the admin clicks Activate for Bone Health
    Then the Bone Health row shows status Active and button Deactivate

  @ui @AC20
  Scenario: Doctors page loads with filters and New button
    When the admin navigates to /admin/doctors
    Then the page heading Doctors is visible
    And the department filter dropdown is visible
    And the status filter dropdown is visible
    And the search input is visible
    And the table has columns Name Department Status and Actions
    And the New button is visible

  @ui @AC20
  Scenario: Admin creates a doctor via the New Doctor modal
    Given an active department named General Medicine exists
    When the admin navigates to /admin/doctors
    And the admin clicks the New button
    Then the modal titled New Doctor appears
    When the admin fills the Name field with Dr. Priya Sharma
    And the admin selects General Medicine in the Department dropdown
    And the admin clicks Save
    Then the modal closes
    And Dr. Priya Sharma appears in the table with department General Medicine

  @ui @AC20
  Scenario: Admin filters doctors by department dropdown
    Given departments Cardiology and General Medicine exist
    And doctor Dr. Arun Mehta is in Cardiology
    And doctor Dr. Priya Sharma is in General Medicine
    When the admin navigates to /admin/doctors
    And the admin selects Cardiology in the department filter
    Then only Dr. Arun Mehta appears in the table
    And Dr. Priya Sharma is not visible

  @ui @AC20
  Scenario: Admin filters doctors by inactive status
    Given Dr. Priya Sharma is active and Dr. Rajesh Patel is inactive in General Medicine
    When the admin navigates to /admin/doctors
    And the admin selects Inactive in the status filter
    Then only Dr. Rajesh Patel appears in the table
    And Dr. Priya Sharma is not visible

  @ui @AC11 @AC20
  Scenario: Admin deactivates a doctor
    Given active doctor Dr. Priya Sharma is in General Medicine
    When the admin navigates to /admin/doctors
    Then the Dr. Priya Sharma row shows status Active and button Deactivate
    When the admin clicks Deactivate for Dr. Priya Sharma
    Then the Dr. Priya Sharma row shows status Inactive and button Activate

  @ui @AC13 @AC20
  Scenario: Activating doctor in inactive department shows alert
    Given inactive department Bone Health exists
    And inactive doctor Dr. Arun Mehta is in Bone Health
    When the admin navigates to /admin/doctors
    And the admin clicks Activate for Dr. Arun Mehta
    Then a browser alert says Cannot activate a doctor while the department is inactive.
    And the doctor status remains Inactive

  @ui @AC20
  Scenario: Doctor row shows Dept inactive badge
    Given inactive department Bone Health exists
    And doctor Dr. Arun Mehta is in Bone Health
    When the admin navigates to /admin/doctors
    Then the Dr. Arun Mehta row shows the Dept inactive badge

  @ui @AC1
  Scenario: Non-admin is redirected away from admin pages
    Given a receptionist is logged in
    When the receptionist navigates to /admin/departments
    Then the page redirects to login or shows unauthorised
