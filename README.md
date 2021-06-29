# CoWIN Vaccine Tracker
A clean, simple and responsive **CoWIN** vaccine tracker that shows available vaccine counts and also help you book an appointment as per your selected options. It is built using Bootstrap 5 and javascript.

### Important Note!
This started as a learning project for me wherein I wanted to make a responsive webpage to help me track the vaccination slots. As it started gaining shape, I added some more features to make it more useful to all. 

#### Tracking Options
The first part of the page lets you select the options/filters. Once you click **Start Tracking** the centers will be displayed based on your choices.
![app_screenshot_1](https://user-images.githubusercontent.com/24500534/123788916-36ef2d00-d8fa-11eb-807b-aa1ba603e450.png)

#### Search Results
The search results are displayed in a table at the bottom of the webpage. Each result row will also have a **Book** button associated with it. If you are logged in the **Booking Scheduler** section of the page (with Beneficiaries selected), the appointment booking will be attempted at the center you have clicked. An alert box will be displayed notifying that the booking was successful or if there was any error with it. **NOTE:** Please ensure that the options you have selected in Tracker area match the dose/vaccine required for the beneficiaries, else the booking will be unsuccessful.
![app_screenshot_2](https://user-images.githubusercontent.com/24500534/123789849-3a36e880-d8fb-11eb-9f7c-75c5070eda7f.png)

#### Booking Scheduler
This form lets you login by sending the OTP and verifying it. Once you select the beneficiaries, you can either start a automated booking or manual booking (clicking Book button on Results table). In the automated booking mode, the app will search for suitable centers as per your selected options, and try to book the first center it was able to find.
![app_screenshot_3](https://user-images.githubusercontent.com/24500534/123790228-b3ced680-d8fb-11eb-936c-08b5ecaa34e6.png)
