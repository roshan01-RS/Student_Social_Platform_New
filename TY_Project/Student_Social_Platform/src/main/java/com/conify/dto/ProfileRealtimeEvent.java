package com.conify.dto;

import java.time.Instant;

public class ProfileRealtimeEvent {

    private String verificationStatus;
    private Instant accountExpireDate;

    public ProfileRealtimeEvent() {}

    public ProfileRealtimeEvent(String verificationStatus, Instant accountExpireDate) {
        this.verificationStatus = verificationStatus;
        this.accountExpireDate = accountExpireDate;
    }

    public String getVerificationStatus() {
        return verificationStatus;
    }

    public void setVerificationStatus(String verificationStatus) {
        this.verificationStatus = verificationStatus;
    }

    public Instant getAccountExpireDate() {
        return accountExpireDate;
    }

    public void setAccountExpireDate(Instant accountExpireDate) {
        this.accountExpireDate = accountExpireDate;
    }
}
