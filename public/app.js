// Supplier Lifecycle Management - Client-side JavaScript

const API_BASE = '/api';

// Navigation
function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(sectionId).classList.add('active');
    event.target.classList.add('active');
}

// Buyer Request Form
document.getElementById('buyer-request-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        companyName: document.getElementById('companyName').value,
        contactEmail: document.getElementById('contactEmail').value,
        contactPhone: document.getElementById('contactPhone').value,
        businessType: document.getElementById('businessType').value,
        categories: document.getElementById('categories').value.split(',').map(c => c.trim()).filter(c => c),
        requestedBy: document.getElementById('requestedBy').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/suppliers/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        const resultBox = document.getElementById('buyer-request-result');
        
        if (result.success) {
            resultBox.className = 'result-box success';
            resultBox.innerHTML = `
                <h3>✓ Supplier Request Created Successfully</h3>
                <p><strong>Supplier ID:</strong> ${result.supplier.id}</p>
                <p><strong>Company:</strong> ${result.supplier.companyName}</p>
                <p><strong>State:</strong> ${result.supplier.currentState}</p>
                <p>Share this Supplier ID with the supplier for registration.</p>
                <button class="btn btn-primary" onclick="sendInvitation('${result.supplier.id}')">Send Registration Invitation</button>
            `;
            e.target.reset();
        } else {
            resultBox.className = 'result-box error';
            resultBox.innerHTML = `<h3>✗ Error</h3><p>${result.error}</p>`;
        }
    } catch (error) {
        const resultBox = document.getElementById('buyer-request-result');
        resultBox.className = 'result-box error';
        resultBox.innerHTML = `<h3>✗ Error</h3><p>${error.message}</p>`;
    }
});

// Send Registration Invitation
async function sendInvitation(supplierId) {
    try {
        const user = document.getElementById('requestedBy').value || 'system';
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}/send-invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user })
        });
        
        const result = await response.json();
        if (result.success) {
            alert('Registration invitation sent successfully!');
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Supplier Registration Form
document.getElementById('supplier-registration-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const supplierId = document.getElementById('supplierIdForReg').value;
    if (!supplierId) {
        alert('Please enter your Supplier ID');
        return;
    }
    
    const formData = {
        contactEmail: document.getElementById('regContactEmail').value,
        taxId: document.getElementById('regTaxId').value,
        businessType: document.getElementById('regBusinessType').value,
        address: {
            street: document.getElementById('regStreet').value,
            city: document.getElementById('regCity').value,
            state: document.getElementById('regState').value,
            zip: document.getElementById('regZip').value,
            country: document.getElementById('regCountry').value
        }
    };
    
    try {
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        const resultBox = document.getElementById('supplier-registration-result');
        
        if (result.success) {
            resultBox.className = 'result-box success';
            resultBox.innerHTML = `
                <h3>✓ Registration Completed Successfully</h3>
                <p><strong>Company:</strong> ${result.supplier.companyName}</p>
                <p><strong>Status:</strong> ${result.supplier.currentState}</p>
                <p>Thank you for registering! Your information is now under internal review.</p>
            `;
            e.target.reset();
        } else {
            resultBox.className = 'result-box error';
            resultBox.innerHTML = `<h3>✗ Error</h3><p>${result.error}</p>`;
        }
    } catch (error) {
        const resultBox = document.getElementById('supplier-registration-result');
        resultBox.className = 'result-box error';
        resultBox.innerHTML = `<h3>✗ Error</h3><p>${error.message}</p>`;
    }
});

// Load Tasks
async function loadTasks(status) {
    try {
        let url = `${API_BASE}/tasks`;
        if (status === 'PENDING') {
            url += '?status=PENDING';
        } else if (status === 'COMPLETED') {
            url += '?status=COMPLETED';
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        const taskList = document.getElementById('task-list');
        if (result.tasks && result.tasks.length > 0) {
            taskList.innerHTML = result.tasks.map(task => `
                <div class="list-item">
                    <h3>${task.description}</h3>
                    <p><strong>Supplier ID:</strong> ${task.supplierId}</p>
                    <p><strong>Type:</strong> ${task.taskType}</p>
                    <p><strong>Status:</strong> <span class="state-badge state-${task.status}">${task.status}</span></p>
                    <p><strong>Assigned To:</strong> ${task.assignedTo}</p>
                    <p><strong>Created:</strong> ${new Date(task.createdAt).toLocaleString()}</p>
                    ${task.status === 'PENDING' ? `
                        <button class="btn btn-primary" onclick="completeTask('${task.id}', '${task.supplierId}')">Complete Task</button>
                        <button class="btn" onclick="viewSupplier('${task.supplierId}')">View Supplier</button>
                    ` : `
                        <p><strong>Completed By:</strong> ${task.completedBy}</p>
                        <p><strong>Completed:</strong> ${new Date(task.completedAt).toLocaleString()}</p>
                    `}
                </div>
            `).join('');
        } else {
            taskList.innerHTML = '<p>No tasks found.</p>';
        }
    } catch (error) {
        document.getElementById('task-list').innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
}

// Complete Task
async function completeTask(taskId, supplierId) {
    const user = prompt('Enter your username:');
    if (!user) return;
    
    const notes = prompt('Enter completion notes (optional):');
    
    try {
        const response = await fetch(`${API_BASE}/tasks/${taskId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, notes })
        });
        
        const result = await response.json();
        if (result.success) {
            alert('Task completed successfully!');
            loadTasks('PENDING');
            
            // Handle specific task types
            const task = result.task;
            if (task.taskType === 'REVIEW_SUPPLIER') {
                if (confirm('Would you like to start the review process for this supplier?')) {
                    await startReview(supplierId, user);
                }
            } else if (task.taskType === 'ERP_SYNC') {
                if (confirm('Would you like to start ERP sync for this supplier?')) {
                    await startERPSync(supplierId, user);
                }
            } else if (task.taskType === 'QUALIFY_SUPPLIER') {
                if (confirm('Would you like to start qualification for this supplier?')) {
                    await startQualification(supplierId, user);
                }
            }
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Workflow Actions
async function startReview(supplierId, reviewer) {
    try {
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewer })
        });
        const result = await response.json();
        if (result.success) {
            alert('Review started successfully!');
            viewSupplier(supplierId);
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function startERPSync(supplierId, user) {
    try {
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}/erp-sync/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user })
        });
        const result = await response.json();
        if (result.success) {
            // Simulate ERP sync completion
            const erpId = 'ERP-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            setTimeout(async () => {
                await completeERPSync(supplierId, erpId, user);
            }, 2000);
            alert('ERP sync started! (Simulating sync...)');
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function completeERPSync(supplierId, erpId, user) {
    try {
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}/erp-sync/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ erpId, user })
        });
        const result = await response.json();
        if (result.success) {
            alert(`ERP sync completed! ERP ID: ${erpId}`);
            viewSupplier(supplierId);
        }
    } catch (error) {
        console.error('Error completing ERP sync:', error);
    }
}

async function startQualification(supplierId, user) {
    try {
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}/qualification/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user })
        });
        const result = await response.json();
        if (result.success) {
            alert('Qualification started successfully!');
            viewSupplier(supplierId);
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Load All Suppliers
async function loadAllSuppliers() {
    try {
        const response = await fetch(`${API_BASE}/suppliers`);
        const result = await response.json();
        
        displaySupplierList(result.suppliers);
    } catch (error) {
        document.getElementById('supplier-list').innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
}

// Filter Suppliers by State
async function filterSuppliersByState() {
    const state = document.getElementById('stateFilter').value;
    if (!state) {
        loadAllSuppliers();
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/suppliers?state=${state}`);
        const result = await response.json();
        
        displaySupplierList(result.suppliers);
    } catch (error) {
        document.getElementById('supplier-list').innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
}

// Display Supplier List
function displaySupplierList(suppliers) {
    const supplierList = document.getElementById('supplier-list');
    if (suppliers && suppliers.length > 0) {
        supplierList.innerHTML = suppliers.map(supplier => `
            <div class="list-item" onclick="viewSupplier('${supplier.id}')">
                <h3>${supplier.companyName}</h3>
                <p><strong>ID:</strong> ${supplier.id}</p>
                <p><strong>State:</strong> <span class="state-badge state-${supplier.currentState}">${supplier.currentState}</span></p>
                <p><strong>Contact:</strong> ${supplier.contactEmail}</p>
                <p><strong>Requested By:</strong> ${supplier.requestedBy}</p>
                ${supplier.erpId ? `<p><strong>ERP ID:</strong> ${supplier.erpId}</p>` : ''}
            </div>
        `).join('');
    } else {
        supplierList.innerHTML = '<p>No suppliers found.</p>';
    }
}

// View Supplier Details (360 Profile)
async function viewSupplier(supplierId) {
    try {
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}`);
        const result = await response.json();
        
        if (result.success) {
            const supplier = result.supplier;
            const detailContainer = document.getElementById('supplier-detail');
            
            detailContainer.innerHTML = `
                <div class="detail-header">
                    <h3>Supplier 360 Profile: ${supplier.companyName}</h3>
                    <span class="state-badge state-${supplier.currentState}">${supplier.currentState}</span>
                </div>
                
                <div class="detail-section">
                    <h3>Company Information</h3>
                    <div class="detail-grid">
                        <div class="detail-field">
                            <label>Supplier ID</label>
                            <value>${supplier.id}</value>
                        </div>
                        <div class="detail-field">
                            <label>Company Name</label>
                            <value>${supplier.companyName}</value>
                        </div>
                        <div class="detail-field">
                            <label>Contact Email</label>
                            <value>${supplier.contactEmail}</value>
                        </div>
                        <div class="detail-field">
                            <label>Contact Phone</label>
                            <value>${supplier.contactPhone || 'N/A'}</value>
                        </div>
                        <div class="detail-field">
                            <label>Business Type</label>
                            <value>${supplier.businessType || 'N/A'}</value>
                        </div>
                        <div class="detail-field">
                            <label>Tax ID</label>
                            <value>${supplier.taxId || 'N/A'}</value>
                        </div>
                    </div>
                </div>
                
                ${supplier.address && (supplier.address.street || supplier.address.city) ? `
                <div class="detail-section">
                    <h3>Address</h3>
                    <p>${supplier.address.street || ''}</p>
                    <p>${supplier.address.city || ''}, ${supplier.address.state || ''} ${supplier.address.zip || ''}</p>
                    <p>${supplier.address.country || ''}</p>
                </div>
                ` : ''}
                
                <div class="detail-section">
                    <h3>Lifecycle Information</h3>
                    <div class="detail-grid">
                        <div class="detail-field">
                            <label>Current State</label>
                            <value><span class="state-badge state-${supplier.currentState}">${supplier.currentState}</span></value>
                        </div>
                        <div class="detail-field">
                            <label>Requested By</label>
                            <value>${supplier.requestedBy}</value>
                        </div>
                        <div class="detail-field">
                            <label>Request Date</label>
                            <value>${new Date(supplier.requestedDate).toLocaleString()}</value>
                        </div>
                        <div class="detail-field">
                            <label>Last Updated</label>
                            <value>${new Date(supplier.updatedAt).toLocaleString()}</value>
                        </div>
                    </div>
                </div>
                
                ${supplier.erpId ? `
                <div class="detail-section">
                    <h3>ERP Integration</h3>
                    <div class="detail-grid">
                        <div class="detail-field">
                            <label>ERP ID</label>
                            <value>${supplier.erpId}</value>
                        </div>
                        <div class="detail-field">
                            <label>ERP Sync Date</label>
                            <value>${new Date(supplier.erpSyncDate).toLocaleString()}</value>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                ${supplier.qualificationScore !== null ? `
                <div class="detail-section">
                    <h3>Qualification</h3>
                    <div class="detail-grid">
                        <div class="detail-field">
                            <label>Score</label>
                            <value>${supplier.qualificationScore}</value>
                        </div>
                        <div class="detail-field">
                            <label>Qualification Date</label>
                            <value>${new Date(supplier.qualificationDate).toLocaleString()}</value>
                        </div>
                        <div class="detail-field">
                            <label>Notes</label>
                            <value>${supplier.qualificationNotes || 'N/A'}</value>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                <div class="detail-section">
                    <h3>Actions</h3>
                    <div>
                        ${getAvailableActions(supplier)}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>Audit Trail</h3>
                    <div class="audit-trail">
                        ${supplier.auditTrail.map(entry => `
                            <div class="audit-entry">
                                <div class="timestamp">${new Date(entry.timestamp).toLocaleString()}</div>
                                <div class="action">${entry.action}</div>
                                <div class="user">By: ${entry.user}</div>
                                ${entry.notes ? `<div>${entry.notes}</div>` : ''}
                            </div>
                        `).reverse().join('')}
                    </div>
                </div>
            `;
            
            detailContainer.classList.add('active');
            
            // Scroll to detail
            detailContainer.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Get Available Actions based on current state
function getAvailableActions(supplier) {
    const actions = [];
    const state = supplier.currentState;
    
    if (state === 'UNDER_REVIEW') {
        actions.push(`<button class="btn btn-primary" onclick="approveSupplier('${supplier.id}')">Approve for ERP</button>`);
        actions.push(`<button class="btn" onclick="rejectSupplier('${supplier.id}')">Reject</button>`);
    } else if (state === 'APPROVED_FOR_ERP') {
        actions.push(`<button class="btn btn-primary" onclick="startERPSync('${supplier.id}', 'admin')">Start ERP Sync</button>`);
    } else if (state === 'UNDER_QUALIFICATION') {
        actions.push(`<button class="btn btn-primary" onclick="qualifySupplier('${supplier.id}')">Qualify</button>`);
        actions.push(`<button class="btn" onclick="disqualifySupplier('${supplier.id}')">Disqualify</button>`);
    } else if (['QUALIFIED', 'DISQUALIFIED', 'REJECTED'].includes(state)) {
        actions.push(`<button class="btn" onclick="deactivateSupplier('${supplier.id}')">Deactivate</button>`);
    }
    
    return actions.join(' ') || '<p>No actions available for current state.</p>';
}

// Workflow Action Functions
async function approveSupplier(supplierId) {
    const reviewer = prompt('Enter your username:');
    if (!reviewer) return;
    const notes = prompt('Enter approval notes:');
    
    try {
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewer, notes })
        });
        const result = await response.json();
        if (result.success) {
            alert('Supplier approved for ERP sync!');
            viewSupplier(supplierId);
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function rejectSupplier(supplierId) {
    const user = prompt('Enter your username:');
    if (!user) return;
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    
    try {
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, reason })
        });
        const result = await response.json();
        if (result.success) {
            alert('Supplier rejected.');
            viewSupplier(supplierId);
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function qualifySupplier(supplierId) {
    const user = prompt('Enter your username:');
    if (!user) return;
    const score = prompt('Enter qualification score (0-100):');
    if (!score) return;
    const notes = prompt('Enter qualification notes:');
    
    try {
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}/qualification/qualify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: parseFloat(score), user, notes })
        });
        const result = await response.json();
        if (result.success) {
            alert('Supplier qualified!');
            viewSupplier(supplierId);
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function disqualifySupplier(supplierId) {
    const user = prompt('Enter your username:');
    if (!user) return;
    const score = prompt('Enter qualification score (0-100):');
    if (!score) return;
    const notes = prompt('Enter disqualification reason:');
    if (!notes) return;
    
    try {
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}/qualification/disqualify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: parseFloat(score), user, notes })
        });
        const result = await response.json();
        if (result.success) {
            alert('Supplier disqualified.');
            viewSupplier(supplierId);
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function deactivateSupplier(supplierId) {
    const user = prompt('Enter your username:');
    if (!user) return;
    const reason = prompt('Enter deactivation reason:');
    if (!reason) return;
    
    try {
        const response = await fetch(`${API_BASE}/suppliers/${supplierId}/deactivate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, reason })
        });
        const result = await response.json();
        if (result.success) {
            alert('Supplier deactivated.');
            viewSupplier(supplierId);
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Initialize - load pending tasks on page load
window.addEventListener('DOMContentLoaded', () => {
    loadTasks('PENDING');
});
