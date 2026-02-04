/**
 * Prokip E-commerce Integration - Admin JavaScript
 */

jQuery(document).ready(function($) {
    // Initialize tooltips
    initTooltips();
    
    // Handle AJAX requests with loading states
    initAjaxHandlers();
    
    // Initialize confirmation dialogs
    initConfirmations();
    
    // Auto-hide notices
    initNoticeAutoHide();
});

/**
 * Initialize tooltips
 */
function initTooltips() {
    $('.prokip-tooltip').each(function() {
        var $this = $(this);
        var tooltipText = $this.attr('title');
        
        if (tooltipText) {
            $this.removeAttr('title').data('tooltip', tooltipText);
            
            $this.hover(
                function(e) {
                    var tooltip = $('<div class="prokip-tooltip-popup">' + tooltipText + '</div>');
                    $('body').append(tooltip);
                    
                    var position = $this.offset();
                    tooltip.css({
                        top: position.top - tooltip.outerHeight() - 10,
                        left: position.left + ($this.outerWidth() / 2) - (tooltip.outerWidth() / 2)
                    }).fadeIn(200);
                },
                function() {
                    $('.prokip-tooltip-popup').fadeOut(200, function() {
                        $(this).remove();
                    });
                }
            );
        }
    });
}

/**
 * Initialize AJAX handlers with loading states
 */
function initAjaxHandlers() {
    // Add loading state to all AJAX requests
    $(document).ajaxStart(function() {
        showGlobalLoading();
    });
    
    $(document).ajaxStop(function() {
        hideGlobalLoading();
    });
    
    // Handle AJAX errors
    $(document).ajaxError(function(event, xhr, settings, error) {
        if (settings.url && settings.url.indexOf('prokip-ecommerce') !== -1) {
            showNotice('AJAX Error: ' + (xhr.responseJSON ? xhr.responseJSON.message : error), 'error');
        }
    });
}

/**
 * Initialize confirmation dialogs
 */
function initConfirmations() {
    // Add confirmation to destructive actions
    $('.prokip-confirm-delete').on('click', function(e) {
        var message = $(this).data('confirm') || 'Are you sure you want to delete this item?';
        if (!confirm(message)) {
            e.preventDefault();
            return false;
        }
    });
    
    // Add confirmation to sync actions
    $('.prokip-confirm-sync').on('click', function(e) {
        var message = $(this).data('confirm') || 'Are you sure you want to start this synchronization?';
        if (!confirm(message)) {
            e.preventDefault();
            return false;
        }
    });
}

/**
 * Initialize auto-hide for notices
 */
function initNoticeAutoHide() {
    setTimeout(function() {
        $('.notice.is-dismissible').each(function() {
            var $notice = $(this);
            if (!$notice.hasClass('notice-error')) {
                $notice.fadeOut(500, function() {
                    $(this).remove();
                });
            }
        });
    }, 5000);
}

/**
 * Show global loading overlay
 */
function showGlobalLoading() {
    if (!$('.prokip-global-loading').length) {
        $('body').append('<div class="prokip-global-loading"><div class="prokip-spinner"></div></div>');
    }
}

/**
 * Hide global loading overlay
 */
function hideGlobalLoading() {
    $('.prokip-global-loading').fadeOut(300, function() {
        $(this).remove();
    });
}

/**
 * Show a notice message
 */
function showNotice(message, type) {
    type = type || 'info';
    var className = 'notice-' + type;
    
    var notice = $('<div class="notice ' + className + ' is-dismissible"><p>' + message + '</p></div>');
    
    // Insert after the first h1 or at the top of .wrap
    var $target = $('.wrap h1').first();
    if ($target.length) {
        $target.after(notice);
    } else {
        $('.wrap').prepend(notice);
    }
    
    // Auto-hide success and info notices
    if (type !== 'error') {
        setTimeout(function() {
            notice.fadeOut(500, function() {
                $(this).remove();
            });
        }, 5000);
    }
    
    // Make dismissible
    notice.on('click', '.notice-dismiss', function() {
        notice.fadeOut(500, function() {
            $(this).remove();
        });
    });
}

/**
 * Format date/time
 */
function formatDateTime(dateString) {
    var date = new Date(dateString);
    return date.toLocaleString();
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Debounce function
 */
function debounce(func, wait) {
    var timeout;
    return function executedFunction() {
        var context = this;
        var args = arguments;
        var later = function() {
            timeout = null;
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
    var inThrottle;
    return function() {
        var args = arguments;
        var context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(function() {
                inThrottle = false;
            }, limit);
        }
    };
}

/**
 * Copy to clipboard
 */
function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            showNotice('Copied to clipboard!', 'success');
        }).catch(function() {
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

/**
 * Fallback copy to clipboard
 */
function fallbackCopyToClipboard(text) {
    var textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showNotice('Copied to clipboard!', 'success');
    } catch (err) {
        showNotice('Failed to copy to clipboard', 'error');
    }
    
    document.body.removeChild(textArea);
}

/**
 * Validate form fields
 */
function validateForm($form) {
    var isValid = true;
    var firstError = null;
    
    $form.find('input[required], select[required], textarea[required]').each(function() {
        var $field = $(this);
        var value = $field.val().trim();
        
        if (!value) {
            isValid = false;
            $field.addClass('error');
            
            if (!firstError) {
                firstError = $field;
            }
        } else {
            $field.removeClass('error');
        }
        
        // Email validation
        if ($field.attr('type') === 'email' && value) {
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                isValid = false;
                $field.addClass('error');
                
                if (!firstError) {
                    firstError = $field;
                }
            }
        }
        
        // URL validation
        if ($field.attr('type') === 'url' && value) {
            try {
                new URL(value);
            } catch (e) {
                isValid = false;
                $field.addClass('error');
                
                if (!firstError) {
                    firstError = $field;
                }
            }
        }
    });
    
    // Focus first error field
    if (firstError) {
        firstError.focus();
        firstError[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    return isValid;
}

/**
 * Make AJAX request with error handling
 */
function makeAjaxRequest(url, data, method) {
    method = method || 'POST';
    
    return $.ajax({
        url: url,
        method: method,
        data: data,
        beforeSend: function(xhr) {
            xhr.setRequestHeader('X-WP-Nonce', wpApiSettings.nonce);
        }
    });
}

/**
 * Poll for updates
 */
function pollForUpdates(url, interval, callback) {
    interval = interval || 30000; // 30 seconds default
    
    function poll() {
        $.get(url)
            .done(function(data) {
                if (callback) {
                    callback(data);
                }
            })
            .always(function() {
                setTimeout(poll, interval);
            });
    }
    
    poll();
}

/**
 * Export functions to global scope
 */
window.ProkipAdmin = {
    showNotice: showNotice,
    copyToClipboard: copyToClipboard,
    validateForm: validateForm,
    makeAjaxRequest: makeAjaxRequest,
    pollForUpdates: pollForUpdates,
    formatDateTime: formatDateTime,
    formatFileSize: formatFileSize,
    debounce: debounce,
    throttle: throttle
};
