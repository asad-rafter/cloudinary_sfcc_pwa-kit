import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import { cloudinary } from '../../../config/default'

const RenderCloudinaryVideoPlayer = ({ cloudinaryImageGallery = {} }) => {
    const cldObj = cloudinaryImageGallery
    const videoPlayerID = cldObj.randomNumber

    useEffect(() => {
        if (cldObj && cldObj.video && cldObj.video.videoURL && cldObj.video.videoURL !== 'null') {
            if (cldObj.videoPlayerEnabled && typeof cloudinary !== 'undefined') {
                if (cloudinary.Cloudinary && cloudinary.Cloudinary.new) {
                    if (document.querySelector('.cld-video-player') && !document.querySelector('.cld-video-player').classList.contains('video-js')) {
                        if (cldObj.domain !== 'res.cloudinary.com') {
                            cldObj.video.widgetOptions.privateCdn = true;
                            cldObj.video.widgetOptions.secureDistribution = cldObj.domain;
                        }
                        const cld = cloudinary.Cloudinary.new({ cloud_name: cldObj.cloudName })
                        if (cld.videoPlayer) {
                            cldObj.video.videoURL = cldObj.video.videoURL.lastIndexOf('?') > -1 ? cldObj.video.videoURL.substring(0, cldObj.video.videoURL.lastIndexOf('?')) + cloudinary.CLD_TRACKING_PARAM : cldObj.video.videoURL + cloudinary.CLD_TRACKING_PARAM
                            const player = cld.videoPlayer(
                                'cld-video-player' + (videoPlayerID ? '-' + videoPlayerID : ''),
                                cldObj.video.widgetOptions
                            )
                            player.source(cldObj.video.videoURL, {
                                queryParams: {
                                    [cloudinary.CLD_TRACKING_PARAM.slice(1).split('=')[0]]: cloudinary.CLD_TRACKING_PARAM.slice(1).split('=')[1]
                                }
                            }).play()
                            player.transformation(cldObj.video.widgetOptions.transformations)
                        }
                    }
                }
            }
        }
    }, [cldObj, videoPlayerID])

    return (
        <>
            {cldObj.videoPlayerEnabled && cldObj.video && cldObj.video.videoURL && (
                <video
                    id={`cld-video-player-${videoPlayerID}`}
                    className="cld-video-player cloudinary-data-container"
                ></video>
            )}
        </>
    )
}

RenderCloudinaryVideoPlayer.propTypes = {
    cloudinaryImageGallery: PropTypes.object
}

export default RenderCloudinaryVideoPlayer
