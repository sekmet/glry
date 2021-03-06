(function (root, factory) {
    /* istanbul ignore next */
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else {
        root.Glry = factory();
    }
}(this, function () {
    'use strict';

    function extend(target, source) {
        if (typeof source !== 'object') return target;
        for (var prop in source) {
            target[prop] = source[prop];
        }
        return target;
    }

    function cssPrefix() {
        var s = (document.body || document.documentElement).style;
        if (s.WebkitTransform == '') return '-webkit-';
        return '';
    }

    function cssTranslateX(element, positionX, speed) {
        var options = {},
            prefix = cssPrefix();
        options[prefix + 'transform'] = 'translateX(' + positionX + ')';
        options[prefix + 'transition'] = prefix + 'transform ' + speed + 's linear, opacity ' + speed + 's linear';
        extend(element.style, options);
    }

    function cssCenter(element, width, height) {
        extend(element.style, {
            'width': width + 'px',
            'height': height + 'px',
            'top': (window.innerHeight - height) / 2 + 'px',
            'left': (window.innerWidth - width) / 2 + 'px'
        });
    }

    function GlryTap(elm) {
        elm.addEventListener('touchstart', this);
        elm.addEventListener('touchmove', this);
        elm.addEventListener('touchend', this);
        elm.addEventListener('touchcancel', this);
        elm.addEventListener('mousedown', this);
        elm.addEventListener('mouseup', this);
    }

    GlryTap.prototype.start = function(e) {
        this.moved = false;
        this.startX = e.clientX || e.touches[0].clientX;
        this.startY = e.clientY || e.touches[0].clientY;
    };

    GlryTap.prototype.move = function(e) {
        if (Math.abs(e.touches[0].clientX - this.startX) > 10 || Math.abs(e.touches[0].clientY - this.startY) > 10) {
            this.moved = true;
        }
    };

    GlryTap.prototype.end = function(e) {
        var tap = new CustomEvent('tap', { bubbles: true, cancelable: true });
        if (!this.moved) {
            e.stopPropagation();
            if (!e.target.dispatchEvent(tap)) {
                e.preventDefault();
            }
        }
    };

    GlryTap.prototype.handleEvent = function (e) {
        switch (e.type) {
            case 'touchstart':  this.start(e);  break;
            case 'touchmove':   this.move(e);   break;
            case 'touchend':    this.end(e);    break;
            case 'touchcancel': this.end(e);    break;
            case 'mousedown':   this.start(e);  break;
            case 'mouseup':     this.end(e);    break;
        }
    };

    function Glry(options) {
        var settings = extend({
                    target: '#figure',
                    animationSpeed: 250,
                    enableKeyboard: true,
                    onLoadStart: false,
                    onLoadEnd: false,
                    load: function () {}
                },
                options),

            elmContainer = typeof settings.target === 'object' ? settings.target : document.querySelector(settings.target),
            elmNavigation = elmContainer.querySelector('.navigation'),
            elmLoading = elmContainer.querySelector('.loading'),
            elmError = elmContainer.querySelector('.error'),
            image = null,
            imageWidth = 0,
            imageHeight = 0,
            swipeDiff = 0,
            inProgress = false;

        window.addEventListener('resize', setImage);
        window.addEventListener('touchmove', preventScrolling);

        toggleVisible();

        if (elmNavigation) {
            var glryTap = new GlryTap(window);
            window.addEventListener('tap', handleNavigationToggle);
            elmNavigation.querySelector('.prev').addEventListener('tap', handleNavigationClick.bind(this, 'left'));
            elmNavigation.querySelector('.next').addEventListener('tap', handleNavigationClick.bind(this, 'right'));
        }

        if (settings.enableKeyboard) {
            window.addEventListener('keydown', handleKeyboard);
        }

        function toggleVisible(elmVisible) {
            [elmLoading, elmError].forEach(function (elm) {
                elm.classList.toggle('hidden', elm !== elmVisible);
            });
        }

        function setImage() {
            if (!image) return true;

            window.scrollTo(0, 0);

            var screenWidth = window.innerWidth,
                screenHeight = window.innerHeight,
                tmpImage = new Image();

            tmpImage.src = image.src;
            tmpImage.onload = function () {
                imageWidth = tmpImage.width;
                imageHeight = tmpImage.height;

                if (imageWidth > screenWidth || imageHeight > screenHeight) {
                    var ratio = imageWidth / imageHeight > screenWidth / screenHeight ? imageWidth / screenWidth : imageHeight / screenHeight;
                    imageWidth /= ratio;
                    imageHeight /= ratio;
                }

                cssCenter(image, imageWidth, imageHeight);
            };
        }

        function loadImage(direction) {
            if (inProgress) return false;

            var src = settings.load(direction);
            if (!src) return false;

            direction = direction === 'left' ? 1 : direction === 'right' ? -1 : 0;

            if (image) {
                image.style.opacity = 0;
                cssTranslateX(image, (100 * direction) - swipeDiff + 'px', settings.animationSpeed / 1000);
                setTimeout(removeImage, settings.animationSpeed);
                swipeDiff = 0;
            }

            inProgress = true;
            toggleVisible(elmLoading);
            if (settings.onLoadStart !== false) settings.onLoadStart();

            setTimeout(function () {
                image = document.createElement('img');
                image.src = src;
                image.onload = function () {
                    elmContainer.appendChild(image);
                    setImage();

                    image.style.opacity = 0;
                    cssTranslateX(image, -100 * direction + 'px', 0);
                    setTimeout(function () {
                        image.style.opacity = 1;
                        cssTranslateX(image, 0 + 'px', settings.animationSpeed / 1000);
                    }, 50);

                    setTimeout(function () {
                        inProgress = false;
                        toggleVisible();
                        if (settings.onLoadEnd !== false) settings.onLoadEnd();
                    }, settings.animationSpeed);
                };
                image.onerror = function () {
                    inProgress = false;
                    toggleVisible(elmError);
                    if (settings.onLoadEnd !== false) settings.onLoadEnd();
                };

                var swipeStart = 0,
                    swipeEnd = 0;

                image.addEventListener('touchstart', function (e) {
                    e.preventDefault();
                    swipeStart = e.pageX || e.touches[0].pageX;
                });

                image.addEventListener('touchmove', function (e) {
                    swipeEnd = e.pageX || e.touches[0].pageX;
                    swipeDiff = swipeStart - swipeEnd;
                    cssTranslateX(image, -swipeDiff + 'px', 0);
                });

                image.addEventListener('touchend', function () {
                    if (Math.abs(swipeDiff) > 50) {
                        loadImage(swipeDiff > 0 ? 'right' : 'left');
                    } else {
                        cssTranslateX(image, 0 + 'px', settings.animationSpeed / 1000);
                    }
                });

            }, settings.animationSpeed + 100);
        }

        function removeImage() {
            if (!image || !image.parentNode) return false;
            image.parentNode.removeChild(image);
            image = null;
        }

        function handleKeyboard(e) {
            e.preventDefault();
            var left = [37, 65, 97];
            var right = [39, 68, 100];
            if (left.indexOf(e.keyCode) > -1) {
                loadImage('left');
            } else if (right.indexOf(e.keyCode) > -1) {
                loadImage('right');
            }
        }

        function preventScrolling(e) {
            e.preventDefault();
        }

        function handleNavigationToggle(e) {
            e.preventDefault();
            elmNavigation.style.opacity = Number(elmNavigation.style.opacity) ? 0 : 1;
        }

        function handleNavigationClick(direction, e) {
            e.stopPropagation();
            loadImage(direction);
        }

        loadImage();

        return {
            loadImage: loadImage
        };
    }

    Glry.prototype.extend = extend;

    return Glry;

}));
