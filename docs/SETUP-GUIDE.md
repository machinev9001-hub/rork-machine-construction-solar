# Setup Guide - Project Tracker System

## Initial System Setup

### Prerequisites
- Mobile device (iOS/Android) or web browser
- Internet connection
- Valid email address
- Company registration documents

---

## Master User Registration

### Step 1: First Time Setup

1. Open the Project Tracker application
2. You'll see the login screen
3. Tap "Sign Up as Master User" link
4. Fill in the registration form:
   - Email address (will be your username)
   - Password (minimum 8 characters)
   - Confirm password
5. Tap "Create Master Account"
6. Check your email for verification link
7. Click the verification link
8. Return to app and log in

### Step 2: Company Profile Setup

After logging in for the first time:

1. Navigate to **Settings**
2. Tap **Company Settings**
3. Tap to expand **Company Details**
4. Fill in all required fields:
   - **Legal Entity Name**: Official registered company name
   - **Company Alias**: Short name or trading name
   - **Address**: Physical business address
   - **Contact Number**: Main company phone
   - **Admin Contact**: Name of primary contact person
   - **Admin Email**: Primary contact email
   - **Company Registration Number**: Official registration number
   - **VAT Number**: Tax registration number
5. Review all information carefully
6. Tap **SAVE** button at the bottom
7. Confirm success message

---

## Adding Your First Users

### Step 1: Navigate to User Management

1. Go to **Settings**
2. Tap **Manage Users**
3. Tap **+ ADD USER** button

### Step 2: Create User Profile

Fill in the user information:

**Required:**
- **User ID**: Unique identifier for login (e.g., EMP001, JOHN001)
  - Must be unique
  - Cannot be changed later
  - Used for login

**Optional but Recommended:**
- Sub Contractor Name
- Legal Entity Name
- Direct Personal Contact Number
- Admin Contact
- Admin Email
- Company Registration Number
- VAT Number

**Important:**
- **User Role**: Select from dropdown
  - Admin: For senior management
  - Planner: For project planners
  - Supervisor: For site supervisors
  - QC: For quality control
  - Operator: For field workers
  - Plant Manager: For equipment management
  - Surveyor: For survey work
  - Staff Manager: For HR functions
  - Logistics Manager: For supply chain

### Step 3: Save and Generate QR Code

1. Review all information
2. Tap **SAVE** button
3. System will:
   - Create user account
   - Generate unique QR code
   - Send welcome email (if email provided)
4. User will appear in the Manage Users list

### Step 4: Distribute Login Credentials

For each new user:

1. Find user in Manage Users list
2. Tap on user card to expand
3. Tap on QR code image to enlarge
4. Options for distribution:
   - **Screenshot**: Take screenshot and send via email/messaging
   - **Print**: Print the QR code for physical distribution
   - **Manual**: Provide User ID and temporary password

---

## User First Login

### For Users with QR Code

1. Open Project Tracker app
2. Tap "Scan QR Code" button
3. Point camera at QR code
4. App will auto-detect and process
5. Set your password when prompted
6. Complete profile information
7. You're ready to use the system

### For Users with Manual Credentials

1. Open Project Tracker app
2. Enter User ID provided by Master User
3. Enter temporary password (if provided)
4. You'll be prompted to set new password
5. Complete profile information
6. You're ready to use the system

---

## System Configuration

### Setting Up Projects (Admin/Planner)

1. Navigate to Projects section
2. Tap "+ CREATE PROJECT"
3. Fill in project details:
   - Project name
   - Description
   - Start date
   - End date
   - Location
   - Assign team members
4. Tap "SAVE"

### Creating Your First Task

1. Navigate to Tasks or Project detail
2. Tap "+ ADD TASK"
3. Fill in task information:
   - Task title
   - Detailed description
   - Assign to user (select from dropdown)
   - Due date
   - Priority level
   - Add attachments if needed
4. Tap "SAVE"
5. Assigned user will receive notification

---

## Best Practices for Initial Setup

### User Management
1. Start with key personnel (Admin, Managers)
2. Add supervisors next
3. Then add field workers
4. Use consistent User ID naming convention:
   - By role: ADM001, PLN001, SUP001
   - By name: JOHNS001, MARYT001
   - By department: HR001, LOG001

### Company Profile
1. Enter accurate legal information
2. Use official company documents as reference
3. Keep contact information updated
4. Review and update regularly

### Security
1. Require strong passwords
2. Change default/temporary passwords immediately
3. Don't share QR codes publicly
4. Print QR codes only when necessary
5. Revoke access for departed employees

### Data Organization
1. Create projects before tasks
2. Use clear naming conventions
3. Set up proper project hierarchy
4. Define clear roles and responsibilities

---

## Common Setup Issues

### Cannot Save Company Settings
**Problem**: Save button doesn't work or shows error

**Solutions:**
- Ensure all required fields are filled
- Check internet connection
- Verify field formats (phone numbers, emails)
- Try refreshing the app

### User Already Exists Error
**Problem**: Cannot create user with chosen User ID

**Solutions:**
- Choose a different User ID
- Check if user already exists in Manage Users
- Ensure User ID has no special characters
- Try with simpler ID format

### QR Code Not Generating
**Problem**: QR code doesn't appear after creating user

**Solutions:**
- Refresh the Manage Users screen
- Tap on user card to expand
- Check internet connection
- Try logging out and back in

### Email Not Received
**Problem**: User doesn't receive welcome email

**Solutions:**
- Check spam/junk folder
- Verify email address is correct
- Check with IT department about email filters
- User can still use QR code for access

---

## Testing Your Setup

### Checklist After Initial Setup

- [ ] Master User can log in successfully
- [ ] Company profile is complete
- [ ] At least one additional user created
- [ ] Test user can log in with QR code
- [ ] Test user has correct role and permissions
- [ ] Can create a test project
- [ ] Can create and assign a test task
- [ ] Can view user list and details
- [ ] Can expand/collapse sections properly
- [ ] Save buttons work on all screens

### Test Scenarios

1. **User Login Test**
   - Create test user
   - Log out as Master User
   - Log in as test user using QR code
   - Verify correct dashboard loads

2. **Permission Test**
   - Log in as different roles
   - Verify each role sees appropriate features
   - Test that restrictions work properly

3. **Task Flow Test**
   - Create project as Admin/Planner
   - Create task as Admin/Planner
   - Assign to Operator
   - Log in as Operator
   - Verify task appears
   - Update task progress
   - Verify update reflected for all users

---

## Getting Help

### Support Resources
- User Manual: See USER-MANUAL.md
- System Overview: See SYSTEM-OVERVIEW.md
- Database Structure: See DATABASE-STRUCTURE.md
- User Roles: See USER-ROLES.md

### Contact Support
If you encounter issues during setup:
1. Document the error message
2. Note what you were trying to do
3. Take screenshots if possible
4. Contact your system administrator
5. Provide User ID and approximate time of issue

---

## Next Steps

After completing initial setup:

1. **Populate User Base**
   - Add all team members
   - Assign appropriate roles
   - Distribute QR codes

2. **Create Project Structure**
   - Add current projects
   - Set up project templates
   - Assign project teams

3. **Configure Workflows**
   - Define task categories
   - Set up approval processes
   - Establish reporting schedules

4. **Train Users**
   - Share user manual
   - Conduct training sessions
   - Create quick reference guides

5. **Monitor & Optimize**
   - Review system usage
   - Gather user feedback
   - Adjust permissions as needed
   - Optimize workflows

---

Last Updated: January 2025
