// =======================
// FILE 2 (NEW FILE)
// src/main/java/com/conify/controller/PresenceController.java
// =======================
package com.conify.controller;

import com.conify.service.PresenceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;

@RestController
public class PresenceController {

    @Autowired
    private PresenceService presenceService;

    @GetMapping("/api/presence/online-users")
    public Set<Long> getOnlineUsers() {
        return presenceService.getOnlineUsersSnapshot();
    }
}
