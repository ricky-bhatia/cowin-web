    var txnId;
    var token;
    var timer;
    var bookingInProgress=false;
    var otpTimeout;
    var tokenTimeout;
    const filters={};
    
    function getDistricts(){
        var state_id = document.getElementById("stateList").value;
        if (state_id){
            $.ajax({
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
                }
            });
        }
    }
    
    function sendOTP(){
        var mobile_num = document.getElementById("mobileNumber").value;
        var secret_key = "U2FsdGVkX182tNdnAfqZdfjJLoUG5aOweFoPZogjSFC3Xg6iSKUdN1yKQx1Zo6oeCaBoFvgUINlgznGVBJ5ejQ==";
        $.ajax({
            type: "POST",
            url: "https://cdn-api.co-vin.in/api/v2/auth/generateMobileOTP",
            data: JSON.stringify({mobile:mobile_num, secret:secret_key}),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function (data) {
                txnId = data.txnId;
                otpTimeout = setTimeout(notifyOTPTimeout, 1000*60*3);
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
    
    function verifyOTP(){
        var otp = document.getElementById("otp").value;
        var otp_sha256 = CryptoJS.SHA256(otp).toString(CryptoJS.enc.Hex);
        //alert(otp_sha256);
        $.ajax({
            type: "POST",
            url: "https://cdn-api.co-vin.in/api/v2/auth/validateMobileOtp",
            data: JSON.stringify({txnId:txnId, otp:otp_sha256}),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function (data) {
                token = data.token;
                clearTimeout(otpTimeout);
                // Token is valid for 15 minutes. After this timeout the session gets logged out
                tokenTimeout = setTimeout(notifyTokenTimeout, 1000*60*15);
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
            }
        });
    }
    function bookAppointment(center_id, session_id, slot_time){
        $.ajax({
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
                alert("Appointment booked successfully.");
                resetBooking();
            },
            error: function (jqxhr, status, error) {
                if (jqxhr.status == 400) {
                    response = JSON.parse(jqxhr.responseText)
                    alert(response.error);
                    resetBooking();
                }
                else if (jqxhr.status == 409) {
                    response = JSON.parse(jqxhr.responseText)
                    console.log(response.error);
                }
            }
        });
    }
    
    function bookingDefault(){
        $("#sendOTPdiv").removeClass('d-none');
        $("#verifyOTPdiv").addClass('d-none');
    }
    function startBooking(){
        filters.selected_bens = [];
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
            bookingInProgress = true;
            startTracking();
            $("#stopBookingBtn").removeClass('d-none');
            $("#startBookingBtn").addClass('d-none');
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
        stopTracking();
        $("#stopBookingBtn").addClass('d-none');
        $("#startBookingBtn").removeClass('d-none');
        $('#beneficiariesList').removeAttr('required');
        $('#startBookingBtn').attr('disabled','disabled');
    }

    function startTracking(){
        if (document.getElementById("districtList").value){
            filters.dist_id     = document.getElementById("districtList").value;
            filters.age_group   = document.getElementById("ageList").value;
            filters.vaccine     = document.getElementById("vaccineList").value;
            filters.fee_type    = document.getElementById("feeList").value;
            filters.dose        = document.getElementById("doseList").value;
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
            timer = setInterval(findByDistrict, 10*1000);
            if (!bookingInProgress){
                $("#stopTrackingBtn").removeClass('d-none');
            }
            $("#startTrackingBtn").addClass('d-none');
            findByDistrict();
        }
    }
    function stopTracking(){
        clearInterval(timer);
        clearTimeout(tokenTimeout);
        $("#stopTrackingBtn").addClass('d-none');
        $("#startTrackingBtn").removeClass('d-none');
        $("#benListdiv").addClass('d-none');
    }
    function notifyTokenTimeout(){
        alert("Session timed-out before any suitable centers were found. Restart the process by sending OTP.");
        resetBooking();
    }
    function notifyOTPTimeout(){
        alert("OTP validity expired. You will need to send OTP again.");
        bookingDefault();
    }
    
    function findByDistrict(){
        var addDay = (new Date().getHours() >= 12 ? 1 : 0)
        const date = moment(new Date()).add(addDay,'d').format("DD-MM-YYYY");
        var centerCnt = 0;
        var autoBooking = document.getElementById("enableBooking").checked;
        const centerList = []
        $.ajax({
            type: "GET",
            url: "https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/findByDistrict?district_id=" + filters.dist_id + "&date=" + date,
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function (data) {
                document.getElementById("centersRows").innerHTML = "";
                $.each(data.sessions, function () {
                    if ((eval('this.available_capacity_dose'+filters.dose+' > 0') && this.min_age_limit == filters.age_group)
                        && (filters.vaccine=="ANY" || this.vaccine.toUpperCase()==filters.vaccine)
                        && (filters.fee_type=="ANY" || this.fee_type.toUpperCase()==filters.fee_type)
                        && (!filters.pincodes.length || filters.pincodes.includes(this.pincode.toString()))
                        && (this.name.match(filters.center_name))
                        && (this.address.match(filters.center_addr))
                       ){
                        if (autoBooking && bookingInProgress){
                            bookAppointment(this.center_id, this.session_id, this.slots.pop());
                        }
                        eval('var valueToPrint = this.name+", "+this.available_capacity_dose'+filters.dose)
                        //var center = "<li class='list-group-item'>"+valueToPrint+"</li>"
                        //$("#centersList").append(center);
                        var center = "<tr><td>"+this.pincode+"</td><td>"+this.name+"</td><td>"+eval('this.available_capacity_dose'+filters.dose)+"</td></tr>";
                        //$("#centersRows").append(center);
                        centerList.push(center);
                        centerCnt += 1;
                    }
                });
                centerList.sort();
                $.each(centerList,function() {
                    $("#centersRows").append(this);
                });
                document.getElementById("mainAlert").innerHTML = "<h6>Total centers found for <strong>"+date+"</strong>: " + centerCnt+"</h6><hr><p class='mb-0'><small>Last refreshed at "+moment(new Date()).format("DD-MM-YYYY HH:mm:ss")+"<small></p>";
                $("#mainAlert").removeClass('d-none');
                $("#mainAlert").addClass('alert-warning');
                document.getElementById("mainAlert").scrollIntoView();
            }
        });
        
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
