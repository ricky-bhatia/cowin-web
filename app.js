    var txnId;
    var token;
    var timer;
    var bookingInProgress=false;
    var trackingInProgress=false;
    var otpTimeout;
    var tokenTimeout=0;
    var tokenTime = 15*60;
    var otpTime = 3*60;
    var tokenPB=0;
    var otpPB=0;
    var bookingRetryCnt = 3;
    const filters={};
    var prevIter = {};
    var firstIter = true;
    const timingAPI_base = 'https://cowin-centers.herokuapp.com';
    const timingAPI_ver  = '/api/v1';
    var center_times=[];
    
    async function getDistricts(){
        var state_id = document.getElementById("stateList").value;
        if (state_id){
            var resp = await $.ajax({
                type: "GET",
                url: "https://cdn-api.co-vin.in/api/v2/admin/location/districts/" + state_id,
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                success: function (data) {
                    $('#districtList').empty();
                    $.each(data.districts, function () {
                        var options = "<option " + "value='" + this.district_id + "'>" + this.district_name + "";
                        $("#districtList").append(options);
                    });
                },
                error: function (jqxhr, status, error) {
                    if (jqxhr.status == 400) {
                        response = JSON.parse(jqxhr.responseText)
                        console.log(response.error);
                    }
                }
            });
            return resp;
        }
    }
    
    function sendOTP(){
        var mobile_num = document.getElementById("mobileNumber").value;
        var secret_key = "U2FsdGVkX182tNdnAfqZdfjJLoUG5aOweFoPZogjSFC3Xg6iSKUdN1yKQx1Zo6oeCaBoFvgUINlgznGVBJ5ejQ==";
        if (mobile_num){
            $.ajax({
                type: "POST",
                url: "https://cdn-api.co-vin.in/api/v2/auth/generateMobileOTP",
                data: JSON.stringify({mobile:mobile_num, secret:secret_key}),
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                success: function (data) {
                    txnId = data.txnId;
                    otpTime = 3*60;
                    otpTimeout = setTimeout(notifyOTPTimeout, 1000*otpTime);
                    otpPB = setInterval(updateOTPProgressBar, 1000);
                    alert("OTP sent on mobile. It will be valid only for 3 minutes.");
                    $("#sendOTPdiv").addClass('d-none');
                    $("#verifyOTPdiv").removeClass('d-none');
                },
                error: function (jqxhr, status, error) {
                    if (jqxhr.status == 400) {
                        response = JSON.parse(jqxhr.responseText)
                        alert(response.error);
                    }
                }
            });
        }
    }
    
    function verifyOTP(){
        var otp = document.getElementById("otp").value;
        if (otp){
            var otp_sha256 = CryptoJS.SHA256(otp).toString(CryptoJS.enc.Hex);
            $.ajax({
                type: "POST",
                url: "https://cdn-api.co-vin.in/api/v2/auth/validateMobileOtp",
                data: JSON.stringify({txnId:txnId, otp:otp_sha256}),
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                success: function (data) {
                    token = data.token;
                    clearTimeout(otpTimeout);
                    clearInterval(otpPB);
                    otpPB = 0;
                    // Token is valid for 15 minutes. After this timeout the session gets logged out
                    tokenTime = 15*60;
                    tokenTimeout = setTimeout(notifyTokenTimeout, 1000*tokenTime);
                    tokenPB = setInterval(updateTokenProgressBar, 1000);
                    alert("OTP verified successfully.");
                    bookingDefault();
                    getBeneficiaries();
                },
                error: function (jqxhr, status, error) {
                    if (jqxhr.status == 400) {
                        response = JSON.parse(jqxhr.responseText)
                        alert(response.error);
                    }
                }
            });
        }
    }
    function getCenterTimes(){
        var qParams = '?past_days=7';
        if (filters.hasOwnProperty('dist_id') || document.getElementById("districtList").value){
            var tmpID = (filters.hasOwnProperty('dist_id')) ? filters.dist_id : document.getElementById("districtList").value;
            qParams += "&district_id="+tmpID;
        }
        if (filters.hasOwnProperty('age_group')){
            qParams += "&age="+filters.age_group;
        }
        var response = $.ajax({
            type: "GET",
            url: timingAPI_base+timingAPI_ver+"/centers/timings"+qParams,
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function (data) {
                center_times = data;
            },
            error: function (jqxhr, status, error) {
                if (jqxhr.status == 400) {
                    response = JSON.parse(jqxhr.responseText)
                    alert(response.error);
                }
            }
        });
        return response;
    }

    function getBeneficiaries(){
        $.ajax({
            type: "GET",
            url: "https://cdn-api.co-vin.in/api/v2/appointment/beneficiaries",
            headers: {"Authorization": "Bearer "+token},
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function (data) {
                $('#beneficiariesList').empty();
                $("#benListdiv").removeClass('d-none');
                $.each(data.beneficiaries, function () {
                    var ben_data = this.name.trim() + " (Age: " + (new Date().getFullYear()-this.birth_year) + ", " + this.vaccination_status + ")"
                    var options = "<option " + "value='" + this.beneficiary_reference_id + "'>" + ben_data + "";
                    $("#beneficiariesList").append(options);
                });
                $('#beneficiariesList').attr('required', 'required');
                $('#startBookingBtn').removeAttr('disabled');
            },
            error: function (jqxhr, status, error) {
                if (jqxhr.status == 400) {
                    response = JSON.parse(jqxhr.responseText)
                    alert(response.error);
                }
            }
        });
    }
    function bookAppointment(center_id, session_id, slot_time){
        var response = $.ajax({
            type: "POST",
            url: "https://cdn-api.co-vin.in/api/v2/appointment/schedule",
            data: JSON.stringify({
                center_id     : center_id,
                session_id    : session_id,
                beneficiaries : filters.selected_bens,
                slot          : slot_time,
                dose          : filters.dose}),
            headers: {"Authorization": "Bearer "+token},
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function (data) {
                updateBookingCount(center_id);
                console.log("Appointment booked successfully.");
            }
        });
        return response;
    }
    function updateBookingCount(center_id){
        $.ajax({
            type: "POST",
            url: timingAPI_base + timingAPI_ver + "/booking/count",
            data: JSON.stringify({
                center_id     : center_id,
                slots         : filters.selected_bens.length}),
            contentType: "application/json; charset=utf-8",
            dataType: "json"
        });
    }
    
    function bookingDefault(){
        $("#sendOTPdiv").removeClass('d-none');
        $("#verifyOTPdiv").addClass('d-none');
    }
    function startBooking(){
        filters.selected_bens = [];
        var autoBooking = document.getElementById("enableBooking").checked;
        if (autoBooking){
            for (var option of document.getElementById('beneficiariesList').options)
            {
                if (option.selected) {
                    filters.selected_bens.push(option.value);
                }
            }
            if (!filters.selected_bens.length){
                alert("Please select one or more beneficiaries.");
            }
            else if (document.getElementById("districtList").value){
                bookingInProgress = true;
                bookingRetryCnt = 3;
                startTracking();
                $("#stopBookingBtn").removeClass('d-none');
                $("#startBookingBtn").addClass('d-none');
            }
            else{
                alert("Please select appropriate options before proceeding with booking.");
            }
        }
        else{
            alert("Please turn on Enable Booking Scheduler option");
        }
    }
    function stopBooking(){
        var stop_process = confirm("Are you sure you want to stop the booking process?");
        if (stop_process){
            resetBooking();
        }
    }
    function resetBooking(){
        bookingInProgress = false;
        clearInterval(tokenPB);
        tokenPB = 0;
        updateProgressBar(0,0);
        stopTracking();
        $("#stopBookingBtn").addClass('d-none');
        $("#startBookingBtn").removeClass('d-none');
        $('#beneficiariesList').removeAttr('required');
        $('#startBookingBtn').attr('disabled','disabled');
    }
    function setupFilters(){
        filters.dist_id     = document.getElementById("districtList").value;
        filters.date        = document.getElementById("datePicker").value;
        filters.age_group   = document.getElementById("ageList").value;
        filters.vaccine     = document.getElementById("vaccineList").value;
        filters.fee_type    = document.getElementById("feeList").value;
        filters.dose        = document.getElementById("doseList").value;
        filters.min_slots   = document.getElementById("minSlots").value;
        filters.print_time  = document.getElementById("enableCenterTimes").checked;
        filters.pincodes    = [];
        if (document.getElementById("pincodeList").value.trim()){
            filters.pincodes    = document.getElementById("pincodeList").value.split(",").map(e => e.trim());
        }
        filters.center_name = new RegExp('.*','gi');
        if (document.getElementById("centerNameList").value.trim()){
            filters.center_name = new RegExp('('+document.getElementById("centerNameList").value.split(",").map(e => e.trim()).join('|')+')','gi');
        }
        filters.center_addr = new RegExp('.*','gi');
        if (document.getElementById("addressList").value.trim()){
            filters.center_addr = new RegExp('('+document.getElementById("addressList").value.split(",").map(e => e.trim()).join('|')+')','gi');
        }
    }
    function handleCenterTimes(chkbox){
        if ((document.getElementById("districtList").value)&&(chkbox.checked==true)){
            $("#centerTimeSpinner").removeClass('d-none');
            getCenterTimes().then(response => {
                console.log("Got center times");
                $("#centerTimeSpinner").addClass('d-none');})
        }
    }
    function findCenters(){
        if (document.getElementById("districtList").value){
            setupFilters();
            if (filters.print_time) getCenterTimes();
            findByDistrict();
        }
    }
    function startTracking(){
        if (document.getElementById("districtList").value){
            setupFilters();
            if (filters.print_time) getCenterTimes();
            timer = setInterval(findByDistrict, 10*1000);
            if (!bookingInProgress){
                $("#stopTrackingBtn").removeClass('d-none');
            }
            $("#startTrackingBtn").addClass('d-none');
            $('#searchOnceBtn').attr('disabled','disabled');
            firstIter = true;
            prevIter = {};
            findByDistrict();
        }
    }
    function stopTracking(){
        clearInterval(timer);
        clearTimeout(tokenTimeout);
        tokenTimeout = 0;
        $("#stopTrackingBtn").addClass('d-none');
        $("#startTrackingBtn").removeClass('d-none');
        $("#benListdiv").addClass('d-none');
        $('#searchOnceBtn').removeAttr('disabled');
    }
    function notifyTokenTimeout(){
        alert("Session timed-out before any suitable centers were found. Restart the process by sending OTP.");
        resetBooking();
    }
    function notifyOTPTimeout(){
        alert("OTP validity expired. You will need to send OTP again.");
        clearInterval(otpPB);
        otpPB = 0;
        updateProgressBar(0,0);
        bookingDefault();
    }
    
    function updateTokenProgressBar(){
        tokenTime -= 1;
        var per = Math.floor((tokenTime/900)*100);
        updateProgressBar(per, tokenTime + ' s');
    }
    function updateOTPProgressBar(){
        otpTime -= 1;
        var per = Math.floor((otpTime/180)*100);
        updateProgressBar(per, otpTime + ' s');
    }
    function updateProgressBar(per,label){
        document.getElementById('progressBar').setAttribute('aria-valuenow',per);
        document.getElementById('progressBar').setAttribute('style','width:'+Number(per)+'%');
        if (label){
            document.getElementById('progressBar').innerHTML = label;
        }
    }
    
    
    function manualBook(centerRow){
        //alert(centerRow.dataset.centerid + " " +centerRow.dataset.sessionid + " "+centerRow.dataset.slot);
        filters.selected_bens = [];
        var autoBooking = document.getElementById("enableBooking").checked;
        if (tokenTimeout){
            if (autoBooking || bookingInProgress){
                alert("Please uncheck Enable Booking Scheduler option to proceed with manual booking. Make sure automated booking session is not started.");
            }
            else{
                for (var option of document.getElementById('beneficiariesList').options)
                {
                    if (option.selected) {
                        filters.selected_bens.push(option.value);
                    }
                }
                if (!filters.selected_bens.length){
                    alert("Please select one or more beneficiaries.");
                }
                else{
                    bookAppointment(centerRow.dataset.centerid, centerRow.dataset.sessionid, centerRow.dataset.slot).then(response => {
                        console.log(response);
                        //resetBooking();
                        alert("Appointment booked successfully at selected center!\n\nLogin on CoWIN site to verify and download your appointment slip.");})
                    .catch(err => {
                        if (err.status==409){
                            console.log(err.responseText);
                        }
                        else if (err.status==400){
                            //resetBooking();
                            alert("Got below error while trying to book appointment.\n\n"+err.responseJSON.error);
                        }
                        else{
                            //resetBooking();
                            alert("Got below error while trying to book appointment.\n\n"+err.responseText);
                        }
                    });
                }
            }
        }
        else{
            alert("Please use the 'Booking Scheduler' form to login and select your beneficiaries.");
        }
    }
    
    async function findByDistrict(){
        var centerCnt = 0;
        var newCenterCnt = 0;
        var autoBooking = document.getElementById("enableBooking").checked;
        var bookingSuccess;
        var holdOff = false;
        const centerList = [];
        var currIter = {};
        var currCount = 0;
        var newCenter = false;
        
        var result = await $.ajax({
            type: "GET",
            url: "https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/findByDistrict?district_id=" + filters.dist_id + "&date=" + filters.date,
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function (data) {
                console.log("Got list of centers");
            }
        });
        $.each(result.sessions, function () {
            newCenter = false;
            if ((eval('this.available_capacity_dose'+filters.dose+' >= '+filters.min_slots) && (this.min_age_limit == filters.age_group || this.allow_all_age))
                && (filters.vaccine=="ANY" || this.vaccine.toUpperCase()==filters.vaccine)
                && (filters.fee_type=="ANY" || this.fee_type.toUpperCase()==filters.fee_type)
                && (!filters.pincodes.length || filters.pincodes.includes(this.pincode.toString()))
                && (this.name.match(filters.center_name))
                && (this.address.match(filters.center_addr))
               ){
                currCount = eval('this.available_capacity_dose'+filters.dose);
                if (autoBooking && bookingInProgress && !holdOff && bookingRetryCnt>0){
                    if (eval('this.available_capacity_dose'+filters.dose+' >='+filters.selected_bens.length)){
                        bookAppointment(this.center_id, this.session_id, this.slots.pop()).then(response => {
                            console.log(response);
                            resetBooking();
                            alert("Appointment booked successfully at below center!\n\n"+this.name+"\nVaccine: "+this.vaccine+"\nFee Type: "+this.fee_type+"\n\nLogin on CoWIN site to verify and download your appointment slip.");})
                        .catch(err => {
                            if (err.status==409){
                                console.log(err.responseText);
                            }
                            else if (err.status==400){
                                resetBooking();
                                alert("Stopping booking due to below error.\n\n"+err.responseJSON.error);
                            }
                            else{
                                resetBooking();
                                alert("Stopping booking due to below error.\n\n"+err.responseText);
                            }
                        });
                        bookingRetryCnt -= 1;
                        holdOff = true;
                    }
                }
                if (currCount >= 5){
                    newCenter = true;
                }
                if (!currIter.hasOwnProperty(this.center_id)){
                    currIter[this.center_id] = {};
                }
                currIter[this.center_id][this.session_id] = currCount;
                if (prevIter.hasOwnProperty(this.center_id)){
                    if (prevIter[this.center_id].hasOwnProperty(this.session_id)){
                        newCenter = false;
                    }
                }
                var row_class = "";
                if (newCenter){
                    row_class = " class='table-success'"; 
                    newCenterCnt += 1;
                }
                var ctimes = '';
                if (filters.print_time && center_times.length>0){
                    var tmpID = this.center_id;
                    var vacc  = this.vaccine.toUpperCase();
                    $.each(center_times, function () {
                        if (this.center_id == tmpID && this.vaccine.startsWith(vacc)){
                            ctimes += moment(this.posting_ts).add(330, 'minutes').format('hh:mm A') + ' | ';
                        }
                    });
                }
                var span_class = (this.vaccine.toUpperCase()=='COVAXIN')?'bg-secondary':((this.vaccine.toUpperCase()=='COVISHIELD')?'bg-primary':'bg-dark');
                var book_btn= '<button type="button" class="btn btn-info btn-sm" onclick="manualBook(this)" data-centerid='+this.center_id+' data-sessionid='+this.session_id+' data-slot='+this.slots[this.slots.length - 1]+'>Book</button>';
                var center = "<tr"+row_class+"><td>"+this.pincode+"</td><td>"+this.name+" <span class='badge rounded-pill "+span_class+"'>"+this.vaccine+"</span><BR/><small class='text-primary'>"+ctimes+"</small></td><td>"+this.available_capacity_dose1+"</td><td>"+this.available_capacity_dose2+"</td><td>"+book_btn+"</td></tr>";
                centerList.push(center);
                centerCnt += 1;
            }
        });
        document.getElementById("centersRows").innerHTML = "";
        centerList.sort();
        $.each(centerList,function() {
            $("#centersRows").append(this);
        });
        document.getElementById("mainAlert").innerHTML = "<h6>Total centers found for <strong>"+filters.date+"</strong>: " + centerCnt+"</h6><hr><p class='mb-0'><small>Last refreshed at "+moment(new Date()).format("DD-MM-YYYY HH:mm:ss")+"<small></p>";
        $("#mainAlert").removeClass('d-none');
        $("#mainAlert").addClass('alert-warning');
        document.getElementById("mainAlert").scrollIntoView();
        if (newCenterCnt > 0){
            audioalert(newCenterCnt);
        }
        prevIter = currIter;
    }
    
    function audioalert(cnt) {
        if (document.getElementById("audioAlertChk").checked){
            const msg = new SpeechSynthesisUtterance(cnt + " new vaccine centers are now available.");
            window.speechSynthesis.speak(msg);
        }
    }
    
    // Populate State options
    $.ajax({
        type: "GET",
        url: "https://cdn-api.co-vin.in/api/v2/admin/location/states",
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (data) {
            $("#stateList").append("<option value=''>Choose State...</option>");
            $.each(data.states, function () {
                var options = "<option " + "value='" + this.state_id + "'>" + this.state_name + "";
                $("#stateList").append(options);
            });
        }
    });
    
    // Initialize bootstrap datepicker
    $('#datePicker').datepicker({
        autoclose: true,
        todayBtn: true,
        todayHighlight: true,
        startDate: "today",
        format: "dd-mm-yyyy"
    });
    document.getElementById("datePicker").value = moment(new Date()).add(1,'d').format("DD-MM-YYYY");
    
    function googleTranslateElementInit() { 
        new google.translate.TranslateElement(
            {pageLanguage: 'en'}, 
            'google_translate_element'
        ); 
    }
    
